import {readFileSync} from 'node:fs';
import path from 'node:path';
export function buildConfig({profile=process.env.BUILD_PROFILE||'release',outputRoot}={}){
 if(outputRoot!==undefined&&(typeof outputRoot!=='string'||!path.isAbsolute(outputRoot)))throw new Error('outputRoot must be an absolute path');
 if(!['release','review','playtest'].includes(profile))throw new Error('BUILD_PROFILE must be release, review or playtest');
 const runtime=JSON.parse(readFileSync(new URL('../runtime-config.json',import.meta.url),'utf8'))[profile];
 if(typeof runtime?.courtyardEnabled!=='boolean')throw new Error('Invalid courtyard runtime configuration');
 if(typeof runtime?.combatSliceEnabled!=='boolean'||runtime.combatSliceEnabled&&(profile!=='playtest'||!runtime.courtyardEnabled))throw new Error('Invalid local combat slice configuration');
 const version=JSON.parse(readFileSync('package.json','utf8')).version;
 const rules=process.env.PLATFORM_RULES_RECORD?JSON.parse(readFileSync(process.env.PLATFORM_RULES_RECORD,'utf8')):null;
 const output=outputRoot?path.join(outputRoot,'records'):'../.local/builds/'+version+'/'+profile;
 return {profile,version,courtyardEnabled:runtime.courtyardEnabled,combatSliceEnabled:runtime.combatSliceEnabled===true,dist:outputRoot?path.join(outputRoot,'base'):({release:'dist-',review:'dist-review-',playtest:'dist-playtest-'})[profile]+version,qa:output,artifacts:output,rules};
}
