import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.test-build',{recursive:true});
await build({entryPoints:['tests/navigation.test.ts'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:'.test-build/navigation.test.mjs'});
const result=spawnSync(process.execPath,['--test','.test-build/navigation.test.mjs'],{stdio:'inherit',windowsHide:true});
process.exitCode=result.status??1;
