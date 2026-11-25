// Independent real Phaser fixtures; normal player entry never imports these.
import {readFileSync,writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const folder=path.resolve(process.env.R1_CHECK_DIR||'../.local/checks/visual-restoration-20261030/runtime-map/'+'fixture');
mkdirSync(folder,{recursive:true});
// Reference textures are generated from the actual C files inside the fixture.
let source=readFileSync('tools/build.mjs','utf8');
function replace(from,to){if(source.split(from).length!==2)throw Error('Fixture build marker changed: '+from);source=source.replace(from,to);}
replace('const config=buildConfig();','const config={...buildConfig(),dist:'+JSON.stringify(folder)+',qa:'+JSON.stringify(path.join(folder,'build'))+'};');
replace("entryPoints: ['src/main.ts']","entryPoints: ['tests/fixtures/"+'r1-map'+".ts']");
const failureInjection=`const createMarker="this.resetEntities(); pauseScene();";if(contents.split(createMarker).length!==2)throw Error('R1 failure marker changed');contents=contents.replace(createMarker,"if((window as any).r1FailCreate){(window as any).r1FailCreate=false;(window as any).r1FailedDetail=this.textures.get('courtyard-native-painting');this.game.events.once('destroy',()=>{(window as any).r1FailedDestroyed=true;});throw Error('R1 fixture initialization failure');}"+createMarker);`;
const hook=`builder.onLoad({filter:/[\\\\/]src[\\\\/]battle\\.ts$/},args=>{const text=readFileSync(args.path,'utf8'),marker='const arena = new Arena();';if(text.split(marker).length!==2)throw Error('Arena fixture marker changed');let contents=text.replace(marker,marker+' (window as any).qaArena=arena; (window as any).qaPosition=resetBody;');${failureInjection}return {contents,loader:'ts',resolveDir:path.dirname(args.path)};});`;
replace('builder.onLoad({ filter:',hook+'\n    builder.onLoad({ filter:');
const temporary=path.resolve('tools/.r1-fixture-build.mjs');
try {writeFileSync(temporary,source);const result=spawnSync(process.execPath,[temporary],{env:{...process.env,BUILD_PROFILE:'playtest'},stdio:'inherit',windowsHide:true});if(result.status!==0)throw Error('Fixture build failed');}
finally {unlinkSync(temporary);}
writeFileSync(path.join(folder,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="assets/style.css"><script defer src="assets/main.js"></script></head><body><div id="stage" style="position:relative;width:390px;height:844px;visibility:visible"></div><pre id="qa-result">RUNNING</pre></body></html>');
console.log(JSON.stringify({fixture:folder,scope:'CONTROLLED_SCENE_NOT_PACKAGE'}));
