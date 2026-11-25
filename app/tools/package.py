import hashlib, json, pathlib, zipfile, shutil, datetime, subprocess, os, re, posixpath
profile = os.environ.get('BUILD_PROFILE', 'release')
if profile not in ('release', 'review', 'playtest'): raise SystemExit('Invalid BUILD_PROFILE')
archive_budget = json.loads(pathlib.Path('asset-budget.json').read_text(encoding='utf-8')).get('archive')
if not isinstance(archive_budget, dict):
    raise SystemExit('Missing archive budget')
archive_max = archive_budget.get('maxBytes')
archive_recommended = archive_budget.get('recommendedBytes')
if type(archive_max) is not int or type(archive_recommended) is not int or not 0 < archive_recommended <= archive_max:
    raise SystemExit('Invalid archive budget')
version = json.loads(pathlib.Path('package.json').read_text(encoding='utf-8'))['version']
base = pathlib.Path({'release': 'dist-', 'review': 'dist-review-', 'playtest': 'dist-playtest-'}[profile] + version)
output = pathlib.Path('../.local/builds') / version / profile
output.mkdir(parents=True, exist_ok=True)
artifact = output / ({'release': 'cat-save-world-combat-auto-', 'review': 'cat-save-world-ui-review-', 'playtest': 'cat-save-world-combat-playtest-'}[profile] + version + '.zip')
if artifact.exists():
    previous_sha = hashlib.sha256(artifact.read_bytes()).hexdigest()
    previous_dir = output / 'history' / previous_sha
    previous_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(artifact, previous_dir / artifact.name)
    if (output / 'manifest.json').exists():
        shutil.copyfile(output / 'manifest.json', previous_dir / 'manifest.json')
# Same bytes on every OS: keep the case-insensitive path order Windows used for published packages and a fixed host system.
def portable_order(path): return [part.lower() for part in path.parts]
# Keep startup code in the main package under the current platform asset policy.
# Only archive paths change; the build and all previously served previews stay intact.
entry_paths = {'assets/boot.js': 'boot.js', 'assets/main.js': 'main.js', 'assets/style.css': 'style.css'}
def package_entry(name, data):
    if name == 'index.html':
        text = data.decode('utf-8')
        for source, target in entry_paths.items():
            text = text.replace('./' + source, './' + target)
        data = text.encode('utf-8')
    elif name == 'assets/style.css':
        def image_url(match):
            value = match.group(2).strip()
            if value.startswith(('#', '/', 'data:', 'blob:')) or re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', value):
                return match.group(0)
            return "url('./" + posixpath.normpath(posixpath.join('assets', value)) + "')"
        data = re.sub(r'''url\(\s*(['"]?)([^)'"\s]+)\1\s*\)''', image_url, data.decode('utf-8')).encode('utf-8')
    return entry_paths.get(name, name), data
files = []
with zipfile.ZipFile(artifact, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted((p for p in base.rglob('*') if p.is_file()), key=portable_order):
        name = path.relative_to(base).as_posix()
        data = path.read_bytes()
        name, data = package_entry(name, data)
        if any(entry['file'] == name for entry in files): raise SystemExit('Duplicate packaged path: ' + name)
        info = zipfile.ZipInfo(name, date_time=(2026,10,8,0,0,0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        info.create_system = 0
        archive.writestr(info, data, compresslevel=9)
        files.append({'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
errors = []
with zipfile.ZipFile(artifact) as archive:
    if archive.testzip() is not None: errors.append('ZIP CRC failure')
    if 'index.html' not in archive.namelist(): errors.append('Missing root index')
    for entry in files:
        if hashlib.sha256(archive.read(entry['file'])).hexdigest() != entry['sha256']: errors.append(entry['file'])
        entry['compressedBytes'] = archive.getinfo(entry['file']).compress_size
data = artifact.read_bytes()
if len(data) > archive_max: errors.append(f'ZIP above project archive budget: {len(data)} > {archive_max} bytes')
source_files = sorted((p for folder in ('src', 'assets', 'tools', 'tests') for p in pathlib.Path(folder).rglob('*') if p.is_file()), key=portable_order)
source_files += [pathlib.Path(f) for f in ('index.html', 'style.css', 'package.json', 'package-lock.json', 'tsconfig.json', 'runtime-config.json', 'asset-budget.json', 'ASSET_SOURCES.json')]
source_records = [{'file': p.as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in source_files]
source_records.sort(key=lambda entry: entry['file'].lower())
source_input_sha = hashlib.sha256(''.join(entry['file']+'\0'+entry['sha256']+'\n' for entry in source_records).encode('utf-8')).hexdigest()
record = {'atUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'version': version, 'profile': profile, 'sourceBaseCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(), 'sourceBranch': subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip(), 'sourceFiles': source_records, 'file': artifact.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'uncompressedBytes': sum(f['bytes'] for f in files), 'files': files, 'errors': errors, 'status': 'FAIL' if errors else 'PASS', 'acceptance': {'release': 'LOCAL_CANDIDATE_ONLY', 'review': 'INTERNAL_REVIEW_ONLY', 'playtest': 'INTERNAL_PLAYTEST_ONLY'}[profile], 'platformSubmission': 'NOT_TESTED'}
record['entryLayout'] = {'entryFiles': entry_paths, 'gameScriptBytesChanged': False, 'previewFilesChanged': False, 'policy': 'Entry JS/CSS outside assets; package-local image URL resolution preserved.'}
record['archiveBudget'] = {**archive_budget, 'headroomBytes': archive_max - len(data), 'recommendedExceeded': len(data) > archive_recommended}
record['sourceInputSha256'] = source_input_sha
record['sourceDirty'] = bool(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all', '--', '.'], text=True).strip())
(output / 'manifest.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(record, ensure_ascii=False))
if errors: raise SystemExit(1)
