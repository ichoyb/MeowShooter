// Part of the local developer tools for testing the game; not part of the game itself. Official release, review and playtest builds leave it out.
import {build} from 'esbuild';
import {cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildConfig} from '../tools/build-config.mjs';
import {createBuildOptions} from '../tools/build-options.mjs';
import {buildApp} from '../tools/build-app.mjs';

export async function buildDevtools(){
 const root=path.resolve('../.local/devtools'),config=buildConfig({profile:'playtest',outputRoot:root});
 const prepared=spawnSync(process.execPath,['tools/prepare-ui.cjs'],{stdio:'inherit'});
 if(prepared.status!==0)throw new Error('UI preparation failed: '+(prepared.error?.message??prepared.status));
 await buildApp(config);
 const preview=path.join(root,'preview');
 rmSync(preview,{recursive:true,force:true});cpSync(config.dist,preview,{recursive:true});
 const {buildOptions}=await createBuildOptions({...config,dist:preview},{devtools:true});
 const result=await build({...buildOptions,entryPoints:['devtools/entry.ts']});
 cpSync('devtools/panel.css',path.join(preview,'assets/devtools.css'));
 const main=readFileSync(path.join(preview,'assets/main.js'));
 const mainSha256=createHash('sha256').update(main).digest('hex');
 writeFileSync(path.join(preview,'index.html'),readFileSync(path.join(preview,'index.html'),'utf8')
  .replace('</head>','<link rel="stylesheet" href="./assets/devtools.css"></head>')
  .replace(/data-build-id="[^"]*"/,'data-build-id="'+mainSha256.slice(0,12)+'"'));
 writeFileSync(path.join(root,'records/devtools-build-record.json'),JSON.stringify({scope:'LOCAL_DEVTOOLS_ONLY',profile:'playtest',version:config.version,mainSha256,mainBytes:main.length,modules:Object.keys(result.metafile.inputs)},null,2)+'\n');
 console.log('本机调试版已构建：'+preview);
 return preview;
}
async function servePreview(preview,noOpen){
 const port=process.env.PORT||'8790',url='http://127.0.0.1:'+port;
 await new Promise((resolve,reject)=>{
  const server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,APP_DIST:preview,PORT:port},stdio:['inherit','pipe','inherit']});
  const stop=signal=>server.kill(signal);
  const interrupt=()=>stop('SIGINT'),terminate=()=>stop('SIGTERM');
  process.once('SIGINT',interrupt);process.once('SIGTERM',terminate);
  let opened=false;
  server.stdout.on('data',chunk=>{
   process.stdout.write(chunk);
   if(!opened&&chunk.toString().includes(url)){
    opened=true;
    if(!noOpen&&process.platform==='darwin'){
     const browser=spawnSync('open',['-a','Google Chrome',url],{stdio:'inherit'});
     if(browser.status!==0){server.kill();reject(new Error('Chrome open failed: '+(browser.error?.message??browser.status)));}
    }
   }
  });
  server.once('error',reject);
  server.once('exit',(code,signal)=>{
   process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',terminate);
   if(code===0||signal==='SIGINT'||signal==='SIGTERM')resolve();else reject(new Error('Local server exited: '+code));
  });
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.some(arg=>arg!=='--no-open'))throw new Error('Usage: npm run play -- [--no-open]');
 await servePreview(await buildDevtools(),args.includes('--no-open'));
}
