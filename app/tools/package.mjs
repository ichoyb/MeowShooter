import { spawnSync } from 'node:child_process';
import {buildConfig} from './build-config.mjs';
const config=buildConfig();
for(const args of [['tools/audit.mjs',config.dist]]){const r=spawnSync(process.execPath,args,{stdio:'inherit',windowsHide:true});if(r.status!==0)process.exit(r.status||1);}
const python=process.env.PYTHON||(process.platform==='win32'?'python':'python3');
const r=spawnSync(python,['tools/package.py'],{stdio:'inherit',windowsHide:true});
if(r.error)throw new Error('Cannot run '+python+' for tools/package.py; set PYTHON to a Python 3 interpreter',{cause:r.error});
process.exitCode=r.status??1;
