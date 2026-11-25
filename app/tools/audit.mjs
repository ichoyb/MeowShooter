import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
import {runtimeImagePath} from '../src/runtime-image-path.cjs';
import g6BattleAssets from '../src/r1-art/g6-battle-paths.json' with {type:'json'};
import chapterScenes from '../src/ui/chapter-scenes.json' with {type:'json'};
const config=buildConfig();
const root = path.resolve(process.argv[2] || config.dist);
const errors=[],files=[];
function walk(folder) { for(const name of readdirSync(folder)) { const full=path.join(folder,name); if(statSync(full).isDirectory())walk(full);else { const data=readFileSync(full),relative=path.relative(root,full).replace(/\\/g,'/'); files.push({file:relative,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}); if(!/\.(?:html|css|js|png|jpg|jpeg|gif|webp|svg|woff|woff2|json)$/.test(name))errors.push('Unsupported file: '+relative); if(/\.(?:html|css|js|json)$/.test(name))scan(relative,data.toString('utf8')); }} }
function scan(file, text) {
 const checks = {
  'network API': /\bfetch\s*\(|\bXMLHttpRequest\b|\b(?:WebSocket|EventSource|RTCPeerConnection)\s*\(/,
  'dynamic code': /\beval\s*\(|\bnew\s+Function\s*\(|\bWebAssembly\b/,
  'worker': /\bnew\s+(?:Worker|SharedWorker)\s*\(|serviceWorker\s*\.\s*register/,
  'forbidden device API': /requestPointerLock|webkitRequestFullscreen|requestFullscreen|(?:navigator\s*\.\s*(?:clipboard|bluetooth|usb|hid|serial|geolocation|getBattery|connection|credentials|locks))|DeviceMotionEvent|DeviceOrientationEvent/,
  'window navigation': /window\s*\.\s*(?:open|prompt)\s*\(/,
  'runtime module': /\bimport\s*(?:\(|\{|\*)|\bexport\s+(?:default|const|class|function|\{)/,
 };
 for(const [name,re] of Object.entries(checks))if(re.test(text))errors.push(file+': '+name);
 if(file.endsWith('.html')) {
  if(/<script\b(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(text))errors.push('Inline script');
  if(/\bon\w+\s*=|javascript:|type=["']module|<(?:base|iframe|object)\b|target=["']_blank|\bdownload\s*=/i.test(text))errors.push('Forbidden HTML');
  if(/Content-Security-Policy/i.test(text))errors.push('Container manages CSP; remove HTML CSP');
  for(const m of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) { if(!m[1].startsWith('./')||!statSafe(path.join(root,m[1])))errors.push('Missing/non-relative resource: '+m[1]); }
 }
 if(file.endsWith('.css')&&/(?:url\(\s*["']?https?:|\bgap\s*:|\baspect-ratio\s*:|\bclamp\(|\binset\s*:|\d+dvh|:has\()/i.test(text))errors.push('CSS baseline violation');
 for(const m of text.matchAll(/data:[^,;]+;base64,([A-Za-z0-9+/=]+)/g))if(Buffer.from(m[1],'base64').length>1024*1024)errors.push('Large Base64');
}
function statSafe(file){try{return statSync(file).isFile();}catch{return false;}}
walk(root);
if(!files.some(f=>f.file==='index.html')||files.filter(f=>f.file.endsWith('.html')).length!==1)errors.push('Root index/single HTML requirement');
const expected=['index.html','assets/boot.js','assets/main.js','assets/style.css'];
if(!config.courtyardEnabled)expected.push('assets/cat.png','assets/atlas.png');
if(config.courtyardEnabled)expected.push(...['enemies.png','held-weapons.png','native/courtyard-native-v01.png'].map(name=>'assets/r1-restoration/'+name));
if(config.profile==='playtest'&&config.courtyardEnabled)expected.push(...g6BattleAssets);
if(config.profile==='playtest'&&config.combatSliceEnabled)expected.push(...Object.values(chapterScenes));
expected.push(...readdirSync('assets/ui').filter(name=>!name.endsWith('.webp')&&(!config.courtyardEnabled||!['FIRE.svg','FROST.svg','SHOCK.svg','SUMMON.svg'].includes(name))).map(name=>'assets/ui/'+name));
if(config.profile==='playtest'&&!config.courtyardEnabled)expected.push(...['body-0.png','body-1.png','weapon.png','grip.png','head.png'].map(name=>'assets/cat01-pilot/'+name));
if(config.profile==='playtest')expected.push(...['bell-hit.png','ground.png'].map(name=>'assets/battle-feedback/'+name));
if(config.combatSliceEnabled)expected.push(...(config.courtyardEnabled?['bubble.png','b01-dust.png']:['parts.png','bubble.png','b01-dust.png']).map(name=>'assets/first-combat/'+name));
const expectedPaths=expected.map(runtimeImagePath);
for(const f of files)if(!expectedPaths.includes(f.file))errors.push('Unexpected packaged file: '+f.file);
for(const f of expectedPaths)if(!files.some(r=>r.file===f))errors.push('Missing packaged file: '+f);
const result={atUtc:new Date().toISOString(),status:errors.length?'FAIL':'PASS',source:'Local static audit',currentPlatformRulesVerified:false,checks:['file whitelist','single root HTML','classic external scripts','relative local resources','forbidden API and dynamic code','baseline CSS','Base64 size'],files,bytes:files.reduce((n,f)=>n+f.bytes,0),errors,platformSubmission:'NOT_TESTED',simulator:'NOT_TESTED',android:'NOT_TESTED',ios:'NOT_TESTED',chrome61:'NOT_TESTED'};
Object.assign(result,{source:config.rules?'Recorded online documentation status; upload-page instruction status is separate in platformRulesEvidence':'Local skill snapshot; current online documentation unverified',currentPlatformRulesVerified:config.rules?.status==='READ_SUCCESS',platformRulesEvidence:config.rules});
result.profile=config.profile;writeFileSync(config.qa+'/'+config.profile+'-artifact-audit.json',JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2)); process.exitCode=errors.length?1:0;
