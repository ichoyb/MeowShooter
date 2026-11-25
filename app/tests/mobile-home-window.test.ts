import test from 'node:test';
import assert from 'node:assert/strict';
import * as layout from '../src/platform/layout';

// Import through the existing platform entry so RED is an assertion about the
// missing capability, rather than a missing-file/build error.
const api=layout as any;
const rect=(left:number,top:number,right:number,bottom:number)=>({left,top,right,bottom,width:right-left,height:bottom-top});
const viewport={width:390,height:844};
const app=rect(0,0,390,844);
const info=()=>({windowWidth:390,windowHeight:844,pixelRatio:3,statusBarHeight:44,screenTop:88,safeArea:rect(0,44,390,820),menuButtons:{back:rect(12,48,56,92),me:null,share:rect(334,48,378,92)}});
const supported=(read:()=>Promise<unknown>,buildVersion:unknown=9490001)=>({launchOptions:{miniToolEnv:{buildVersion}},miniTool:{getWindowInfo:read}});
const deferred=()=>{let resolve!:(value:unknown)=>void;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};

test('home uses container safe and button rectangles once, without screen/status/navigation offsets',()=>{
 assert.equal(typeof api.nativeHomeInsets,'function','native home area capability is missing');
 assert.deepEqual(api.nativeHomeInsets(info(),viewport,app),{top:100,bottom:24,left:0,right:0});
 const hidden=info();hidden.menuButtons={back:null,me:null,share:null} as any;
 assert.deepEqual(api.nativeHomeInsets(hidden,viewport,app),{top:52,bottom:24,left:0,right:0});
});

test('native logical units map through the viewport, with centered app and unrelated native buttons excluded',()=>{
 assert.equal(typeof api.nativeHomeInsets,'function','native home area capability is missing');
 const native={...info(),windowWidth:800,windowHeight:600,safeArea:rect(0,24,800,580),menuButtons:{back:rect(10,26,54,70),me:null,share:rect(746,26,790,70)}};
 assert.deepEqual(api.nativeHomeInsets(native,{width:1600,height:1200},rect(585,134,1015,1066)),{top:0,bottom:0,left:0,right:0});
 const scaled={...info(),windowWidth:195,windowHeight:422,safeArea:rect(0,22,195,410),menuButtons:{back:null,me:null,share:null}};
 assert.deepEqual(api.nativeHomeInsets(scaled,viewport,app),{top:52,bottom:24,left:0,right:0});
});

test('incomplete, inverted and non-finite native geometry never replaces CSS layout',()=>{
 assert.equal(typeof api.nativeHomeInsets,'function','native home area capability is missing');
 for(const bad of [null,{}, {...info(),windowWidth:0}, {...info(),safeArea:null}, {...info(),safeArea:rect(0,850,390,820)}, {...info(),menuButtons:{back:{top:NaN},me:null,share:null}}]){
  assert.equal(api.nativeHomeInsets(bad,viewport,app),null);
 }
});

test('home window reads require supported explicit build and capability, with no render request loop',async()=>{
 assert.equal(typeof api.createHomeWindowReader,'function','home window reader is missing');
 const reader=api.createHomeWindowReader();let reads=0,changes=0;
 const read=async()=>{reads++;return info();};
 for(const host of [{},supported(read,9489999),supported(read,null),{launchOptions:{miniToolEnv:{buildVersion:9490001}},miniTool:{}}])await reader.refresh(host,'390x844',()=>{changes++;});
 assert.equal(reads,0);
 const host=supported(read);
 await reader.refresh(host,'390x844',()=>{changes++;});
 await reader.refresh(host,'390x844',()=>{changes++;});
 assert.equal(reads,1);assert.equal(changes,1);assert.deepEqual(reader.current('390x844'),info());
});

test('timed-out launch data cannot start a late window request',async()=>{
 assert.equal(typeof api.createHomeWindowReader,'function','home window reader is missing');
 const reader=api.createHomeWindowReader(5),launch=deferred();let reads=0,changes=0;
 await reader.refresh({miniTool:{getLaunchOptions:()=>launch.promise,getWindowInfo:async()=>{reads++;return info();}}},'slow',()=>{changes++;});
 launch.resolve({miniToolEnv:{buildVersion:9490001}});await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(reads,0);assert.equal(changes,0);assert.equal(reader.current('slow'),null);
});

test('missing synchronous launch data uses async launch data without delaying the caller',async()=>{
 assert.equal(typeof api.createHomeWindowReader,'function','home window reader is missing');
 const reader=api.createHomeWindowReader(),launch=deferred();let reads=0;
 const host={miniTool:{getLaunchOptions:()=>launch.promise,getWindowInfo:async()=>{reads++;return info();}}};
 const pending=reader.refresh(host,'390x844',()=>{});
 assert.equal(reads,0);assert.equal(reader.current('390x844'),null);
 launch.resolve({miniToolEnv:{buildVersion:9490001}});await pending;
 assert.equal(reads,1);assert.deepEqual(reader.current('390x844'),info());
});

test('resize races discard stale window data and failed or malformed responses preserve valid data',async()=>{
 assert.equal(typeof api.createHomeWindowReader,'function','home window reader is missing');
 const reader=api.createHomeWindowReader(),old=deferred(),fresh=deferred();let changes=0;
 const a=reader.refresh(supported(()=>old.promise),'old',()=>{changes++;});
 const b=reader.refresh(supported(()=>fresh.promise),'new',()=>{changes++;});
 fresh.resolve(info());await b;old.resolve({...info(),windowHeight:999});await a;
 assert.equal(changes,1);assert.deepEqual(reader.current('new'),info());assert.equal(reader.current('old'),null);
 await reader.refresh(supported(async()=>{throw Error('failed refresh');}),'new',()=>{changes++;});
 assert.deepEqual(reader.current('new'),info());assert.equal(changes,1);
 const outside=info();outside.menuButtons.back=rect(12,800,56,900);
 await reader.refresh(supported(async()=>outside),'new',()=>{changes++;});
 assert.deepEqual(reader.current('new'),info());assert.equal(changes,1);
 await reader.refresh(supported(async()=>{throw Error('native unavailable');}),'failed',()=>{changes++;});
 assert.equal(changes,1);assert.equal(reader.current('failed'),null);
 await reader.refresh(supported(async()=>({windowWidth:390})),'malformed',()=>{changes++;});
 assert.equal(changes,1);assert.equal(reader.current('malformed'),null);
});

test('non-home layout retains legacy battle insets and does not request native home geometry',()=>{
 let reads=0;const styleValues:Record<string,string>={};
 const globals=globalThis as any,previous={window:globals.window,document:globals.document,getComputedStyle:globals.getComputedStyle};
 try{
  globals.window={devicePixelRatio:3,xhs:supported(async()=>{reads++;return info();})};
  globals.document={getElementById:()=>({})};globals.getComputedStyle=()=>({paddingTop:'44px',paddingBottom:'24px'});
  const app={clientWidth:390,clientHeight:844,dataset:{},style:{setProperty:(key:string,value:string)=>{styleValues[key]=value;}},classList:{contains:()=>false}};
  assert.deepEqual(layout.readLayout(app as any),{width:390,height:844,dpr:3,safeTop:44,safeBottom:24,hostNavigation:56,gap:8,contentTop:108});
  assert.deepEqual(styleValues,{'--content-top':'108px','--safe-bottom':'24px'});assert.equal(reads,0);
 }finally{Object.assign(globals,previous);}
});
