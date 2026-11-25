import {createBattle} from '../../src/battle';
import {ImageBudget} from '../../src/image-budget';
import {registerUIAsset,getUIAsset} from '../../src/ui/assets';
import Factory from 'phaser/src/gameobjects/GameObjectFactory';
import sourceRecords from '../../ASSET_SOURCES.json';

const w=window as any,checks:any[]=[],released=new Map<object,number>();
const nativeGraphics=Factory.prototype.graphics;
Factory.prototype.graphics=function(...args:any[]){
  w.nativeArena=this.scene;
  if(w.failCreate){w.failCreate=false;throw Error('G8 controlled native initialization failure');}
  return nativeGraphics.apply(this,args);
};
class Budget extends ImageBudget {
  override release(image:Parameters<ImageBudget['release']>[0]){released.set(image,(released.get(image)||0)+1);super.release(image);}
}
const budget=new Budget(5242880),stage=document.getElementById('stage')!;
const check=(name:string,ok:unknown,observed:unknown)=>{checks.push({name,status:ok?'PASS':'FAIL',observed});if(!ok)throw Error(name);};
const image=(name:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='./assets/ui/'+name;});
async function run(){
  for(const name of ['CAT01.png','CAT02.png','CAT03.png','garden.jpeg','W01.svg','W02.svg','W04.svg','BALL.svg','MAG.svg','GUARD.svg','MOVE.svg'])registerUIAsset(name,await image(name),budget);
  const cats={CAT01:getUIAsset('CAT01.png'),CAT02:getUIAsset('CAT02.png'),CAT03:getUIAsset('CAT03.png')};
  const retained=budget.snapshot();
  const create=()=>createBattle(stage,{onState(){},onInterrupt(){},onFinish(){}},cats,budget,true);
  const uiOnly=()=>budget.snapshot().sourceRGBA===retained.sourceRGBA&&budget.snapshot().backgroundRGBA===retained.backgroundRGBA&&budget.snapshot().sources.length===retained.sources.length;
  const destroyed=(game:any)=>new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('native destroy timeout')),4000);game.events.once('destroy',()=>{clearTimeout(timer);resolve();});});
  for(let cycle=0;cycle<2;cycle++){
    const battle=await create(),game=w.nativeArena.game,before=budget.snapshot();game.loop.sleep();
    check('cycle '+cycle+' complete native G6 source ledger',before.sourceRGBA===sourceRecords.cat01RoundBodyAdoption.nonBackgroundSourceRGBA&&before.backgroundRGBA===7328392&&before.sources.length===27,before);
    const done=destroyed(game);battle.dispose();battle.dispose();
    check('cycle '+cycle+' stays charged during deferred destruction',game.pendingDestroy&&budget.snapshot().sourceRGBA===before.sourceRGBA,{pending:game.pendingDestroy,budget:budget.snapshot()});
    await done;
    check('cycle '+cycle+' actual Game.destroy releases only owned sources',uiOnly()&&stage.querySelectorAll('canvas').length===0,{budget:budget.snapshot(),retained});
    check('cycle '+cycle+' owned objects released exactly once',released.size===(cycle+1)*18&&Array.from(released.values()).every(v=>v===1),{released:released.size,counts:Array.from(released.values())});
  }
  w.failCreate=true;let failure='';try{await create();}catch(error){failure=String(error);}
  const failedGame=w.nativeArena.game;
  if(failedGame?.pendingDestroy)await destroyed(failedGame);
  check('failed initialization releases its entire batch once',failure.includes('G8 controlled native initialization failure')&&uiOnly()&&released.size===54&&Array.from(released.values()).every(v=>v===1),{failure,budget:budget.snapshot(),released:released.size});
  const retry=await create(),game=w.nativeArena.game,done=destroyed(game);retry.dispose();await done;
  check('retry then native destroy returns exactly to original UI ledger',uiOnly()&&released.size===72&&Array.from(released.values()).every(v=>v===1),{budget:budget.snapshot(),released:released.size});
  w.result={status:'PASS',checks};document.body.dataset.qa='PASS';
}
run().catch(error=>{w.result={status:'FAIL',error:String(error),stack:error.stack,checks};document.body.dataset.qa='FAIL';});
