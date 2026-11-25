import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const {BUILD_PROFILE, G6_NORMAL_DIST, G6_TIMELINE_DIR} = process.env;
if (BUILD_PROFILE !== 'playtest' || !G6_NORMAL_DIST || !G6_TIMELINE_DIR) {
  throw Error('Set BUILD_PROFILE=playtest, G6_NORMAL_DIST and G6_TIMELINE_DIR');
}
const dist = path.resolve(G6_NORMAL_DIST), output = path.resolve(G6_TIMELINE_DIR);
if (existsSync(output)) throw Error('Use a new G6_TIMELINE_DIR');
const main = path.join(dist, 'assets/main.js');
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const mainSHA256 = hash(main);
const {buildOptions} = await import('./build.mjs');
if (hash(buildOptions.outfile) !== mainSHA256) throw Error('G6_NORMAL_DIST differs from current source build');
cpSync(dist, output, {recursive: true});
const outfile = path.join(output, 'assets/g6-timeline.js');
await build({...buildOptions, entryPoints: ['tests/fixtures/g6-normal-timeline.ts'], outfile});
writeFileSync(path.join(output, 'index.html'), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>G6 受控时间验证</title><script defer src="./assets/g6-timeline.js"></script></head><body><div id="stage" style="width:390px;height:844px;position:relative"></div></body></html>');
writeFileSync(path.join(output, 'g6-timeline.json'), JSON.stringify({scope: 'CONTROLLED_QA_NOT_PLAYER_ENTRY',
  mainSHA256, fixtureSHA256: hash(outfile)}, null, 2) + '\n');
console.log(output);
