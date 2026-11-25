// Standalone controlled comparison. Never imported by the normal player entry.
import {createTraitFixture} from './projectile-traits-sample';
import {normalCourtyardRunConfig} from '../../src/level-config';
import {hudMarkup,r1HUDValues} from '../../src/ui/hud';
import type {CatId} from '../../src/combat-config';
const w=window as any;
async function boot(){
 const $=(id:string)=>document.getElementById(id)!;
 let started=false,lastFact='',quality:'standard'|'low'='standard',f:Awaited<ReturnType<typeof createTraitFixture>>;
 const draw=(s:any)=>{
  if(!started)return;
  if(!$('health'))return;
  const v=r1HUDValues(s),hud=s.feedback.hud;
  $('health').textContent=v.health;$('timer').textContent=v.remaining;$('ammo').textContent=v.ammo;$('level').textContent=v.level;
  $('hud').querySelector<HTMLElement>('.hp-meter i')!.style.width=(s.hp/s.maxHp*100)+'%';
  $('hud').querySelector<HTMLElement>('.hp-trail')!.style.width=(hud.hpTrailRatio*100)+'%';
  $('survival-progress').style.width=v.percent+'%';$('survival-progress').style.filter='brightness('+(1+hud.xpPulse*.55)+')';
  $('battle-hurt-edge').style.opacity=String(hud.hurtEdgeAlpha);
  $('fact').textContent=`主弹 ${s.sourceCounts.PRIMARY} · 暴击命中 ${s.projectileTraits.criticalHits} · 拾取经验 ${s.pickups.collectedXP}。${lastFact}`;
  $('stage').dataset.state=JSON.stringify(s);
 };
 f=await createTraitFixture($('stage'),draw);
 const {battle,a}=f;
 const wait=async(fn:()=>boolean)=>{const end=performance.now()+8000;while(!fn()){if(performance.now()>end)throw Error('场景准备超时');await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}};
 const position=(s:any,x:number,y:number)=>{s.body.reset(x,y);s.body.updateFromGameObject();s.body.prev.copy(s.body.position);s.body.prevFrame.copy(s.body.position);};
 const start=async()=>{
  started=false;lastFact='';const previous=f.session;
  battle.setPresentation({quality});battle.start(normalCourtyardRunConfig(f.config(($('cat') as HTMLSelectElement).value as CatId)));
  await wait(()=>!!f.session&&f.session!==previous);
  a.spawns.take=()=>null;a.trySpecialSpawn=()=>{};
  for(const e of a.enemies.getChildren())if(e.active)a.recycle(e,a.enemies);
  position(a.cat,360,720);const e=a.placeSliceEnemy('E01',460,720);e.setData('hp',100000);e.body.moves=false;
  a.projectileRandom.frac=()=>($('critical') as HTMLSelectElement).value==='critical'?0:.99;
  if(($('shield') as HTMLInputElement).checked)f.install({C13:1});
  $('hud').innerHTML=hudMarkup(battle.snapshot(),false,1,false,'对照小样',true);
  $('hud').querySelector('button')?.remove();
  started=true;f.layout();draw(battle.snapshot());$('status').textContent='独立对照进行中：靶子静止，伤害和经验真实生效。';
 };
 $('start').addEventListener('click',()=>void start());
 $('pause').addEventListener('click',()=>battle.pause('menu'));$('resume').addEventListener('click',()=>battle.resume());
 $('quality').addEventListener('change',()=>{quality=($('quality') as HTMLSelectElement).value as typeof quality;battle.setPresentation({quality});f.layout();});
 for(const [id,amount] of [['hurt',10],['absorb',4],['break',30]] as const)$(id).addEventListener('click',()=>{
  const fact=a.incomingEnemyDamage(amount);lastFact=`护盾吸收${fact.shieldAbsorbed}／生命损失${fact.hpLost}／破盾${fact.shieldBroke?'是':'否'}${fact.accepted?'。':'（当前未生效）。'}`;draw(battle.snapshot());
 });
 $('xp').addEventListener('click',()=>{a.pickups.drop(999999+Math.floor(f.session!.elapsed*1000),'E01',{...battle.snapshot().player});});
 window.addEventListener('resize',f.layout);window.addEventListener('blur',()=>{if(started)battle.pause('inputLost');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)battle.pause('background');});
 w.g5FeedbackSample={f,start};w.g5FeedbackSampleReady=true;
 for(const el of Array.from(document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select,input')))el.disabled=false;
 $('status').textContent='准备好，选择配对和普通／暴击，然后开始对照。';
}
void boot().catch(e=>{w.g5FeedbackSampleError=String(e);document.getElementById('status')!.textContent=String(e);});
