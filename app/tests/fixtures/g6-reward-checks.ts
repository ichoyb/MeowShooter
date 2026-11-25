import type {G6RewardPresentation} from '../../src/g6-reward-presentation';
import {Session} from '../../src/rules';
import {makeRunConfig} from '../../src/combat-config';
import {normalCourtyardRunConfig} from '../../src/level-config';

// Real Scene/Clock checks, called by the standalone sample's browser runner.
export async function checkG6Rewards(p:G6RewardPresentation,wait:(ms:number)=>Promise<void>){
 const results:{name:string;pass:boolean}[]=[];
 const check=(name:string,pass:boolean)=>{results.push({name,pass});if(!pass)throw Error(name);};
 p.reset();p.setEnabled(true);p.heal(0,{x:100,y:100});await wait(280);
 check('零量不会产生治疗',p.snapshot().healBatches===0);
 p.heal(.25,{x:100,y:100});p.heal(.5,{x:90,y:100});
 check('结算后等待表现窗口',p.snapshot().pendingHealing===.75&&p.snapshot().healBatches===0);
 await wait(300);check('250ms合并真实量',p.snapshot().healBatches===1&&p.snapshot().displayedHealing===.75);
 p.heal(.5,{x:90,y:100});p.interrupt();await wait(300);
 check('中断清待播不补播',p.snapshot().pendingHealing===0&&p.snapshot().displayedHealing===.75);
 p.reset();p.setEnabled(false);p.heal(1,{x:0,y:0});await wait(300);
 check('旧版不接新治疗反馈',p.snapshot().healBatches===0);
 const config=normalCourtyardRunConfig(makeRunConfig('CAT01','W01','p2-basic'));
 const run=(enabled:boolean)=>{
  const session=new Session(config);session.applyGrowth({L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,C21:1,C13:1});
  p.reset();p.setEnabled(enabled);session.damage(30);
  for(let i=0;i<100;i++){
   const before=session.elapsed;session.step(.1,{x:1,y:0});
   const recovered=session.recordSustainHit({source:'PRIMARY',targetKind:'enemy',actualDamage:12});
   p.heal(recovered,{x:50,y:50});session.settleShieldRecovery(before);
   p.sync({x:100,y:100},session.defenseSnapshot(),null,0,null);
  }
  return JSON.stringify(session.snapshot());
 };
 check('相同输入下开关表现不改真实Session',run(false)===run(true));
 p.reset();const s=new Session(config);s.applyGrowth({L1_DAMAGE:0,L1_RATE:0,L1_HEART:0,C21:1,C13:1});
 p.setEnabled(true);p.heal(s.recordSustainHit({source:'PRIMARY',targetKind:'enemy',actualDamage:20}),{x:10,y:10});
 check('满血无虚假治疗',p.snapshot().pendingHealing===0);
 p.sync({x:100,y:100},s.defenseSnapshot(),null,0,null);check('真实护盾获得',p.snapshot().shieldVisible);
 p.incoming(s.damage(4));p.sync({x:100,y:100},s.defenseSnapshot(),null,0,null);
 check('仅吸盾不回血',p.snapshot().pendingHealing===0&&s.hp===config.maxHp);
 p.incoming(s.damage(30));p.sync({x:100,y:100},s.defenseSnapshot(),null,0,null);
 check('空盾壳退场',!p.snapshot().shieldVisible&&p.snapshot().shieldBreaks===1);
 for(let i=0;i<80;i++){const from=s.elapsed;s.advance(.1);s.settleShieldRecovery(from);}
 p.sync({x:100,y:100},s.defenseSnapshot(),null,0,null);check('真实恢复后护罩回来',p.snapshot().shieldVisible);
 p.sync({x:100,y:100},s.defenseSnapshot(),{id:1,x:80,y:80,attached:false},0,null);
 p.sync({x:100,y:100},s.defenseSnapshot(),{id:2,x:120,y:80,attached:false},0,null);
 check('同帧换部署ID也让旧守卫退场',p.snapshot().stationId===2&&p.snapshot().retirements===1);
 p.sync({x:100,y:100},s.defenseSnapshot(),null,0,null);
 check('过期无实体和假射击',!p.snapshot().guardVisible&&p.snapshot().retirements===2&&p.snapshot().guardedShots===0);
 const count=p.snapshot().objects;
 for(let i=0;i<20;i++){p.heal(1,{x:80,y:90});p.reset();}
 check('20次重置对象不增长且无待播',p.snapshot().objects===count&&p.snapshot().pendingHealing===0&&p.snapshot().activeEffects===0);
 p.reset();return results;
}
