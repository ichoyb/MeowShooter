const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const g6BattleAssets = require('../src/r1-art/g6-battle-paths.json');
const chapterScenes = require('../src/ui/chapter-scenes.json');
const { runtimeImagePath } = require('../src/runtime-image-path.cjs');
const app = path.resolve(__dirname, '..'), root = path.dirname(app);
const version = JSON.parse(fs.readFileSync(path.join(app, 'package.json'))).version;
const budgetConfig = path.join(app, 'asset-budget.json');

test('release, review and playtest have separate predictable build directories', () => {
  for (const [profile, prefix] of [['release', 'dist-'], ['review', 'dist-review-'], ['playtest', 'dist-playtest-']]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', 'import {buildConfig} from "./tools/build-config.mjs"; process.stdout.write(JSON.stringify(buildConfig()))'], { cwd: app, env: { ...process.env, BUILD_PROFILE: profile }, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout); assert.equal(config.dist, prefix + version);
    assert.equal(config.profile, profile); assert.equal(config.artifacts, '../.local/builds/' + version + '/' + profile);
    assert.equal(Object.hasOwn(config, 'testInputDiagnostics'), false, 'player configuration must not expose the test-only switch');
  }
});

test('environment variables cannot enable player input diagnostics in any profile', () => {
  for (const profile of ['release', 'review', 'playtest']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', 'import {buildConfig} from "./tools/build-config.mjs"; import {createBuildOptions} from "./tools/build-options.mjs"; const {buildOptions}=await createBuildOptions(buildConfig()); process.stdout.write(JSON.stringify(buildOptions.define))'], {
      cwd: app, env: {...process.env, BUILD_PROFILE: profile, TEST_INPUT_DIAGNOSTICS: 'true'}, encoding: 'utf8', windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).__TEST_INPUT_DIAGNOSTICS__, 'false');
  }
});

test('an unknown build profile is rejected rather than producing a public package', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', 'import {buildConfig} from "./tools/build-config.mjs"; buildConfig()'], { cwd: app, env: { ...process.env, BUILD_PROFILE: 'unknown' }, encoding: 'utf8', windowsHide: true });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /BUILD_PROFILE/);
});

test('static artifact audit accepts courtyard and G6 sources only in playtest and rejects retired files', () => {
  const parent=path.join(root,'.local','tmp');fs.mkdirSync(parent,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(parent,'r1-audit-')),work=path.join(fixture,'app');fs.mkdirSync(work);
  fs.writeFileSync(path.join(work,'package.json'),JSON.stringify({version}));fs.mkdirSync(path.join(work,'assets/ui'),{recursive:true});
  for(const profile of ['release','review','playtest']){
    const prefix={release:'dist-',review:'dist-review-',playtest:'dist-playtest-'}[profile],dist=path.join(work,prefix+version);
    fs.mkdirSync(path.join(dist,'assets'),{recursive:true});fs.mkdirSync(path.join(fixture,'.local/builds',version,profile),{recursive:true});
    const current=['index.html','assets/boot.js','assets/main.js','assets/style.css',...['enemies.png','held-weapons.png','native/courtyard-native-v01.png'].map(name=>'assets/r1-restoration/'+name),'assets/battle-feedback/bell-hit.png','assets/battle-feedback/ground.png','assets/first-combat/bubble.png','assets/first-combat/b01-dust.png',...g6BattleAssets];
    if(profile==='playtest')current.push(...Object.values(chapterScenes));
    if(profile!=='playtest')current.push('assets/cat.png','assets/atlas.png');
    for(const name of current.map(runtimeImagePath)){fs.mkdirSync(path.dirname(path.join(dist,name)),{recursive:true});fs.writeFileSync(path.join(dist,name),'');}
    const audit=()=>spawnSync(process.execPath,[path.join(app,'tools/audit.mjs')],{cwd:work,env:{...process.env,BUILD_PROFILE:profile},encoding:'utf8',windowsHide:true});
    const result=audit(),report=JSON.parse(result.stdout);assert.equal(result.status,profile==='playtest'?0:1,JSON.stringify(report.errors));
    if(profile==='playtest'){
      assert.deepEqual(report.errors,[]);
      for(const name of ['assets/cat.png','assets/atlas.png','assets/first-combat/parts.png','assets/cat01-pilot/body-0.png','assets/ui/FIRE.svg','assets/r1-restoration/orange-body.png','assets/r1-restoration/orange-parts.png']){fs.mkdirSync(path.dirname(path.join(dist,name)),{recursive:true});fs.writeFileSync(path.join(dist,name),'');}
      const retired=audit(),rejected=JSON.parse(retired.stdout);assert.equal(retired.status,1);assert.equal(rejected.errors.length,7);
    }else {assert.equal(report.errors.filter(e=>e.includes('r1-restoration')).length,3);assert.equal(report.errors.filter(e=>e.includes('battle-feedback')).length,2);assert.equal(report.errors.filter(e=>e.includes('first-combat')).length,2);assert.equal(report.errors.filter(e=>e.includes('assets/g6-')).length,11);}
  }
});

test('the real packager produces isolated profile names, bytes and acceptance records', () => {
  const base = path.join(root, '.local', 'tmp'); fs.mkdirSync(base, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(base, 'p2-build-profile-')), work = path.join(fixture, 'app'); fs.mkdirSync(work);
  for (const name of ['package.json', 'package-lock.json']) fs.writeFileSync(path.join(work, name), JSON.stringify({ version }));
  for (const name of ['index.html', 'style.css', 'tsconfig.json', 'runtime-config.json', 'asset-budget.json', 'ASSET_SOURCES.json']) fs.writeFileSync(path.join(work, name), name === 'index.html' ? '<html></html>' : '{}');
  fs.copyFileSync(budgetConfig, path.join(work, 'asset-budget.json'));
  for (const [profile, prefix, name, acceptance] of [
    ['release', 'dist-', 'cat-save-world-combat-auto-', 'LOCAL_CANDIDATE_ONLY'],
    ['review', 'dist-review-', 'cat-save-world-ui-review-', 'INTERNAL_REVIEW_ONLY'],
    ['playtest', 'dist-playtest-', 'cat-save-world-combat-playtest-', 'INTERNAL_PLAYTEST_ONLY'],
  ]) {
    const dist = path.join(work, prefix + version); fs.mkdirSync(dist); fs.writeFileSync(path.join(dist, 'index.html'), '<html>' + profile + '</html>');
    const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    const result = spawnSync(python, [path.join(app, 'tools/package.py')], { cwd: work, env: { ...process.env, BUILD_PROFILE: profile }, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const output = path.join(fixture, '.local', 'builds', version, profile), record = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json')));
    assert.equal(record.file, name + version + '.zip'); assert.equal(record.profile, profile); assert.equal(record.acceptance, acceptance);
    assert.equal(record.status, 'PASS'); assert.equal(record.platformSubmission, 'NOT_TESTED'); assert.deepEqual(record.errors, []);
    assert.ok(record.sourceFiles.some(entry=>entry.file==='ASSET_SOURCES.json'));
    assert.ok(record.sourceFiles.some(entry=>entry.file==='asset-budget.json'));
    const input=require('node:crypto').createHash('sha256').update(record.sourceFiles.map(entry=>entry.file+'\0'+entry.sha256+'\n').join('')).digest('hex');
    assert.equal(record.sourceInputSha256,input);
    assert.equal(typeof record.sourceDirty,'boolean');
    assert.equal(record.files[0].file, 'index.html'); assert.equal(fs.statSync(path.join(output, record.file)).size, record.bytes);
    assert.equal(record.archiveBudget.maxBytes, JSON.parse(fs.readFileSync(budgetConfig)).archive.maxBytes);
  }
});

test('packager enforces the exact archive byte boundary in all profiles', () => {
  const parent=path.join(root,'.local','tmp');fs.mkdirSync(parent,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(parent,'archive-limit-')),work=path.join(fixture,'app');fs.mkdirSync(work);
  for(const name of ['package.json','package-lock.json'])fs.writeFileSync(path.join(work,name),JSON.stringify({version}));
  for(const name of ['index.html','style.css','tsconfig.json','runtime-config.json','ASSET_SOURCES.json'])fs.writeFileSync(path.join(work,name),'{}');
  const python=process.env.PYTHON||(process.platform==='win32'?'python':'python3');
  const configure=(maxBytes,recommendedBytes)=>fs.writeFileSync(path.join(work,'asset-budget.json'),JSON.stringify({archive:{maxBytes,recommendedBytes}}));
  for(const [profile,prefix] of [['release','dist-'],['review','dist-review-'],['playtest','dist-playtest-']]){
    const dist=path.join(work,prefix+version);fs.mkdirSync(dist);
    fs.writeFileSync(path.join(dist,'index.html'),'<html>Packager boundary</html>');
    const pack=()=>spawnSync(python,[path.join(app,'tools/package.py')],{cwd:work,env:{...process.env,BUILD_PROFILE:profile},encoding:'utf8',windowsHide:true});
    const configured=JSON.parse(fs.readFileSync(budgetConfig)).archive;
    assert.ok(Number.isSafeInteger(configured?.maxBytes));
    configure(configured.maxBytes, configured.recommendedBytes);
    const initial=pack();
    assert.equal(initial.status,0,initial.stderr);
    const {bytes}=JSON.parse(initial.stdout);
    configure(bytes,bytes);
    const exact=pack();
    assert.equal(exact.status,0,exact.stderr);
    assert.equal(JSON.parse(exact.stdout).bytes,bytes);
    configure(bytes-1,bytes-1);
    const excess=pack();
    assert.equal(excess.status,1,excess.stderr);
    const record=JSON.parse(excess.stdout);
    assert.equal(record.status,'FAIL');
    assert.equal(record.bytes-record.archiveBudget.maxBytes,1);
    assert.match(record.errors.join(' '),/ZIP above project archive budget/);
  }
});

for (const [profile, prefix] of [['release','dist-'],['review','dist-review-'],['playtest','dist-playtest-']]) {
  test(profile+' ZIP keeps entry code in the main package and preserves CSS image resolution', () => {
    const parent=path.join(root,'.local','tmp');fs.mkdirSync(parent,{recursive:true});
    const fixture=fs.mkdtempSync(path.join(parent,'entry-package-')),work=path.join(fixture,'app');fs.mkdirSync(work);
    for(const name of ['package.json','package-lock.json'])fs.writeFileSync(path.join(work,name),JSON.stringify({version}));
    for(const name of ['index.html','style.css','tsconfig.json','runtime-config.json','asset-budget.json','ASSET_SOURCES.json'])fs.writeFileSync(path.join(work,name),'{}');
    fs.copyFileSync(budgetConfig, path.join(work, 'asset-budget.json'));
    const dist=path.join(work,prefix+version);fs.mkdirSync(path.join(dist,'assets/ui'),{recursive:true});
    fs.writeFileSync(path.join(dist,'index.html'),'<link rel="stylesheet" href="./assets/style.css"><script src="./assets/boot.js"></script><script src="./assets/main.js"></script>');
    const main='window.packageWitness="unchanged";',boot='window.bootWitness=true;',css=".home{background:url('./ui/garden.png')}.icon{background:url(\"ui/icon.svg\")} .inline{background:url(data:image/png;base64,YQ==)}";
    fs.writeFileSync(path.join(dist,'assets/main.js'),main);fs.writeFileSync(path.join(dist,'assets/boot.js'),boot);fs.writeFileSync(path.join(dist,'assets/style.css'),css);
    fs.writeFileSync(path.join(dist,'assets/ui/garden.png'),'original image');fs.writeFileSync(path.join(dist,'assets/ui/icon.svg'),'<svg/>');
    const python=process.env.PYTHON||(process.platform==='win32'?'python':'python3');
    const pack=()=>{const p=spawnSync(python,[path.join(app,'tools/package.py')],{cwd:work,env:{...process.env,BUILD_PROFILE:profile},encoding:'utf8',windowsHide:true});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);};
    const first=pack();assert.deepEqual(first.files.map(f=>f.file).sort(),['assets/ui/garden.png','assets/ui/icon.svg','boot.js','index.html','main.js','style.css'].sort());
    const archive=path.join(fixture,'.local/builds',version,profile,first.file);
    const inspect=spawnSync(python,['-c','import zipfile,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))',archive],{encoding:'utf8',windowsHide:true});assert.equal(inspect.status,0,inspect.stderr);const actual=JSON.parse(inspect.stdout);
    assert.equal(actual['main.js'],main);assert.equal(actual['boot.js'],boot);assert.equal(actual['assets/ui/garden.png'],'original image');
    assert.match(actual['index.html'],/href="\.\/style\.css"/);assert.match(actual['index.html'],/src="\.\/boot\.js"/);assert.match(actual['index.html'],/src="\.\/main\.js"/);
    assert.match(actual['style.css'],/url\(['"]\.\/assets\/ui\/garden\.png['"]\)/);assert.match(actual['style.css'],/url\(['"]\.\/assets\/ui\/icon\.svg['"]\)/);assert.match(actual['style.css'],/url\(data:image\/png;base64,YQ==\)/);
    assert.equal(fs.readFileSync(path.join(dist,'assets/style.css'),'utf8'),css,'packaging must not mutate the preview');
    assert.equal(pack().sha256,first.sha256,'same source must produce deterministic ZIP bytes');
  });
}
