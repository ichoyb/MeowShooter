import {createBattle} from '../../src/battle';
import {ImageBudget} from '../../src/image-budget';

const w=window as any,checks:any[]=[];
const out=document.getElementById('qa-result')!;
function check(name:string,ok:unknown,observed:unknown):void {checks.push({name,status:ok?'PASS':'FAIL',observed});if(!ok)throw Error(name);}
function image(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});}
const waitFor=async(predicate:()=>boolean):Promise<void>=>{const end=performance.now()+3000;while(!predicate()){if(performance.now()>end)throw Error('native lifecycle event timeout');await new Promise(resolve=>setTimeout(resolve,10));}};

async function run():Promise<void>{
  const [CAT01,CAT02,CAT03]=await Promise.all(['CAT01','CAT02','CAT03'].map(id=>image('./assets/ui/'+id+'.png')));
  const uiImages=[CAT01,CAT02,CAT03],releaseCounts=new Map<object,number>();
  class ObservedBudget extends ImageBudget {
    override release(image:Parameters<ImageBudget['release']>[0]):void {
      releaseCounts.set(image,(releaseCounts.get(image)??0)+1);super.release(image);
    }
  }
  const budget=new ObservedBudget(5242880),stage=document.getElementById('stage')!;
  const callbacks={onState(){},onInterrupt(){},onFinish(){}};
  const cats={CAT01,CAT02,CAT03};
  const create=()=>createBattle(stage,callbacks,cats,budget);
  const uiOnly=()=>budget.snapshot().sourceRGBA===1226072&&budget.snapshot().sources.length===3&&budget.snapshot().sources.every(source=>source.name.startsWith('ui/'));

  for(let cycle=0;cycle<2;cycle++){
    const battle=await create(),game=w.qaArena.game;
    game.loop.sleep();const before=budget.snapshot();
    check('cycle'+cycle+' actual Arena owns11 images while retaining3 sharedUI sources',before.sourceRGBA===4864064&&before.sources.length===14,before);
    let destroyCount=0;const destroyed=new Promise<void>(resolve=>game.events.once('destroy',()=>{destroyCount++;resolve();}));
    battle.dispose();battle.dispose();
    check('cycle'+cycle+' pending native destruction remains charged until resources are destroyed',game.pendingDestroy&&budget.snapshot().sourceRGBA===4864064,{pendingDestroy:game.pendingDestroy,budget:budget.snapshot()});
    await destroyed;
    const after=budget.snapshot();
    check('cycle'+cycle+' native Game DESTROY releases3637992B and keeps3UI images',uiOnly()&&destroyCount===1&&stage.querySelectorAll('canvas').length===0,{before,after,destroyCount,canvases:stage.querySelectorAll('canvas').length});
    check('cycle'+cycle+' repeated dispose releases each owned decoded object exactly once',releaseCounts.size===(cycle+1)*11&&Array.from(releaseCounts.values()).every(count=>count===1)&&uiImages.every(image=>!releaseCounts.has(image)),{releasedObjects:releaseCounts.size,releaseCalls:Array.from(releaseCounts.values()),uiReleased:uiImages.some(image=>releaseCounts.has(image))});
  }

  // The internal test bundle throws inside the actual Arena.create try/catch;
  // the normal player entry has no injection or exported test function.
  w.h1FailCreate=true;w.h1FailedDestroyed=false;let failure='';
  try {await create();}catch(error){failure=String(error);}
  check('actual Scene initialization failure rejects and releases its batch immediately',failure.includes('H1 fixture initialization failure')&&uiOnly(),{failure,budget:budget.snapshot()});
  await waitFor(()=>w.h1FailedDestroyed===true);
  check('failed native Game destruction does not release any image twice',uiOnly()&&releaseCounts.size===33&&Array.from(releaseCounts.values()).every(count=>count===1)&&stage.querySelectorAll('canvas').length===0,{budget:budget.snapshot(),releasedObjects:releaseCounts.size,releaseCalls:Array.from(releaseCounts.values())});

  const retry=await create(),game=w.qaArena.game;
  check('same shared budget recreates an actual Arena after initialization failure without double counting',budget.snapshot().sourceRGBA===4864064&&budget.snapshot().sources.length===14,budget.snapshot());
  const destroyed=new Promise<void>(resolve=>game.events.once('destroy',resolve));retry.dispose();await destroyed;
  check('failure retry destruction leaves exactly the original three UI sources',uiOnly()&&releaseCounts.size===44&&Array.from(releaseCounts.values()).every(count=>count===1)&&uiImages.every(image=>!releaseCounts.has(image)),{budget:budget.snapshot(),releasedObjects:releaseCounts.size,releaseCalls:Array.from(releaseCounts.values())});
  w.h1LifecycleResult={status:'PASS',checks,scope:'Actual Phaser Game/Scene and shared decoded-object ImageBudget; controlled initialization failure; not phone acceptance'};
  out.textContent=JSON.stringify(w.h1LifecycleResult,null,2);document.body.dataset.qa='PASS';
}
run().catch(error=>{w.h1LifecycleResult={status:'FAIL',error:String(error),stack:error.stack,checks};out.textContent=JSON.stringify(w.h1LifecycleResult,null,2);document.body.dataset.qa='FAIL';});
