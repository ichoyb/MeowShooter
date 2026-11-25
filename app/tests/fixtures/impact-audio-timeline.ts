import {Session} from '../../src/rules';
import {makeRunConfig,type WeaponId,type CatId} from '../../src/combat-config';
import {courtyardBalanceRunConfig} from '../../src/level-config';
import type {AuditionEvent} from './g5-audio-timeline';

// A fixed audition, not actual enemy waves, real critical probability or HP loss.
// Both sound schemes consume precisely the same current, zero-growth root cadence.
export function impactAudioTimeline(weapon:WeaponId,density:'sparse'|'crowded'){
 const cat=({W01:'CAT01',W04:'CAT02',W02:'CAT03'} as Record<WeaponId,CatId>)[weapon];
 const run=courtyardBalanceRunConfig(makeRunConfig(cat,weapon,'p2-basic'));
 const session=new Session(run),events:AuditionEvent[]=[];
 for(let frame=0;frame<13*60;frame++){
  const root=session.step(frame===0?0:1/60,{x:1,y:0});if(!root)continue;
  const at=600+Math.round(session.elapsed*1000);if(at>13100)continue;
  events.push({at,type:'fire',root:root.id,label:'当前零成长主武器齐射'});
  events.push({at:at+180,type:'contact',critical:root.id%4===0,root:root.id,label:root.id%4===0?'固定暴击示意':'普通命中示意'});
 }
 events.push({at:2400,type:'defeat',label:'击败示意'},{at:2900,type:'xp',label:'经验拾取示意'},
  {at:4500,type:'damage',hpLost:0,shieldBroke:false,label:'护盾吸收 · 不播受伤或破盾'},
  {at:5800,type:'damage',hpLost:0,shieldBroke:true,label:'仅破盾 · 短碎弧'},
  {at:8200,type:'damage',hpLost:10,shieldBroke:false,label:'生命下降 · 低沉警示'},
  {at:10800,type:'damage',hpLost:4,shieldBroke:true,label:'破盾且掉血 · 只播受伤声'});
 if(density==='crowded')for(let at=1700,i=0;at<12500;at+=100,i++){
  for(const offset of [0,25,50])events.push({at:at+offset,type:'contact',critical:i%7===0,label:'怪潮混音压力请求',stress:true});
  if(i%3===0)events.push({at:at+20,type:'xp',label:'密集拾取请求',stress:true});
  if(i%5===0)events.push({at:at+35,type:'defeat',label:'密集击败请求',stress:true});
 }
 return {duration:14000,events:events.sort((a,b)=>a.at-b.at),rootSource:'existing Session / courtyardBalanceRunConfig / current G7 zero growth / 60Hz sampled',fixedFacts:true};
}
