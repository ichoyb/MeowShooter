import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
import {createBuildOptions} from './build-options.mjs';

if (process.env.BUILD_PROFILE !== 'playtest') throw Error('Set BUILD_PROFILE=playtest');
const config = buildConfig();
const dist = path.resolve(process.env.N1_NORMAL_DIST || config.dist);
const output = path.resolve(process.env.N1_SCENE_DIR || '../.local/checks/n1-runtime-20261112/scene');
if (existsSync(output)) throw Error('Use a new N1_SCENE_DIR; do not replace an evidence artifact');
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const normalMain = path.join(dist, 'assets/main.js');
const normalMainSHA256 = hash(normalMain);
cpSync(dist, output, {recursive: true});
const {buildOptions, versions} = await createBuildOptions(config);
const outfile = path.join(output, 'assets/n1-runtime.js');
const result = await build({...buildOptions, entryPoints: ['tests/fixtures/n1-runtime.ts'], outfile});
const inputs = Object.keys(result.metafile.inputs).map(name => name.replaceAll('\\', '/'));
if (!inputs.includes('src/main.ts') || !inputs.includes('tests/fixtures/n1-runtime.ts')) throw Error('Fixture must bundle the unchanged real main');
const html = readFileSync(path.join(output, 'index.html'), 'utf8');
const oldEntry = '<script id="game-script" defer src="./assets/main.js"></script>';
if (html.split(oldEntry).length !== 2) throw Error('Unexpected normal script entry');
writeFileSync(path.join(output, 'index.html'), html.replace(oldEntry, '<script id="game-script" defer src="./assets/n1-runtime.js"></script>'));
if (hash(normalMain) !== normalMainSHA256) throw Error('Normal player bundle changed while copying fixture');
const receipt = {scope: 'CONTROLLED_QA_NOT_PLAYER_ENTRY', atUtc: new Date().toISOString(),
  normalDist: dist, normalMainSHA256, fixtureSHA256: hash(outfile), versions,
  sourceMainSHA256: hash(path.resolve('src/main.ts')), sourceFixtureSHA256: hash(path.resolve('tests/fixtures/n1-runtime.ts')),
  normalStyleSHA256: hash(path.join(dist, 'assets/style.css')), fixtureStyleSHA256: hash(path.join(output, 'assets/style.css')),
  mutations: 'Only fixture JS and HTML script entry; normal bundle/source are not rebuilt or rewritten'};
writeFileSync(path.join(output, 'n1-runtime.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({output, ...receipt}, null, 2));
