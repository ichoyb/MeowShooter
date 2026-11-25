// Build-time inventory only. Actual decoded-object ownership is checked in-browser.
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {buildConfig} from './build-config.mjs';
import {imageDimensions} from './image-dimensions.mjs';
function files(folder){return readdirSync(folder,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(path.join(folder,item.name)):[path.join(folder,item.name)]);}
export function checkImageBudget(config){
const limits=JSON.parse(readFileSync('asset-budget.json','utf8'));
const sources=[],backgrounds=[];
assert.equal(limits.sourceBudgetModes?.[config.profile],'strict','image budget must be strict');
for(const file of files(config.dist).filter(f=>/\.(png|svg|jpe?g|webp|gif)$/.test(f))){
 const relative=path.relative(config.dist,file).replaceAll('\\','/');
 const data=readFileSync(file),{width,height}=imageDimensions(data,path.extname(file));
 const measurement={file:relative,width,height,bytes:width*height*4,compressedBytes:data.length};
 if(limits.backgroundSources.includes(relative)){backgrounds.push(measurement);continue;}
 assert(width<=limits.maxSourceEdge&&height<=limits.maxSourceEdge,'invalid source edge: '+relative);
 sources.push(measurement);
}
const sourceRGBA=sources.reduce((sum,s)=>sum+s.bytes,0),limit=limits.sourceRGBALimits[config.profile];
assert(sourceRGBA<=limit,'combined sources exceed budget');assert(limit-sourceRGBA>=limits.minimumHeadroom,'insufficient source headroom');
return {status:'PASS',mode:'strict',warnings:[],profile:config.profile,sourceRGBA,limit,headroom:limit-sourceRGBA,sources,backgrounds,backgroundRGBA:backgrounds.reduce((sum,s)=>sum+s.bytes,0),scope:'STATIC_PACKAGE_INVENTORY_NOT_HEAP_OR_PHONE_PERFORMANCE'};
}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url))console.log(JSON.stringify(checkImageBudget(buildConfig())));
