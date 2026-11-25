import {spawnSync} from 'node:child_process';
const profile=process.argv[2]||'review';
if(!['review','playtest'].includes(profile))throw new Error('Internal build must be review or playtest');
for(const args of [['tools/prepare-ui.cjs'],['tools/build.mjs'],['tools/package.mjs']]){
 const result=spawnSync(process.execPath,args,{env:{...process.env,BUILD_PROFILE:profile},stdio:'inherit',windowsHide:true});
 if(result.status!==0)process.exit(result.status||1);
}
