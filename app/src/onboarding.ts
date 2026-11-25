export type OnboardingKind='move'|'fire'|'xp'|'upgrade'|'objective';
export type OnboardingFacts={travel:number;droppedXP:number;collectedXP:number;offerId:string|number|null;confirmedPicks:number;primaryShots?:number;elapsed?:number;danger?:boolean};
const TEXT={move:'拖动空白处移动，不用找出口',fire:'靠近敌人自动开火，装填时也能移动',xp:'靠近星光，拾取经验变强',upgrade:'选一项本局强化，再点确认',objective:'十分钟内击败雾壳巨兽'};
// Observations only. Scene Clock controls emphasis; expiry never completes a step.
export class SessionOnboarding {
 private hint:OnboardingKind|null=null;
 private completed={move:false,fire:false,xp:false,upgrade:false};
 private seen={move:false,fire:false,xp:false,upgrade:false,objective:false};
 private compact=false;private skipped=false;private travel=0;private until=-Infinity;
 private facts:OnboardingFacts={travel:0,droppedXP:0,collectedXP:0,offerId:null,confirmedPicks:0};
 startRun():void {this.skipped=false;this.until=-Infinity;this.travel=0;this.hint=null;this.compact=false;this.facts={travel:0,droppedXP:0,collectedXP:0,offerId:null,confirmedPicks:0};this.select();}
 private select():void {
  const f=this.facts;
  const next=this.skipped?null:!this.completed.upgrade&&f.offerId!==null?'upgrade':!this.completed.move?'move':!this.completed.fire?'fire':!this.completed.xp&&f.droppedXP>f.collectedXP?'xp':!this.completed.upgrade&&f.offerId!==null?'upgrade':null;
  if(next!==this.hint){this.hint=next;this.compact=false;if(next)this.seen[next]=true;}
 }
 observe(facts:OnboardingFacts):void {
  this.facts={...facts};this.travel=facts.travel;
  this.completed.move ||= facts.travel>=12;this.completed.fire ||= (facts.primaryShots??0)>0;
  this.completed.xp ||= facts.collectedXP>0;this.completed.upgrade ||= facts.confirmedPicks>0;this.select();
 }
 expire(kind:OnboardingKind):void {if(this.hint===kind)this.compact=true;}
 clearTransient():void {this.compact=true;}
 skip():void {this.skipped=true;this.hint=null;}
 hurt(now:number):void {this.until=now+1.2;this.compact=true;}
 snapshot(){const hidden=this.facts.danger||(this.facts.elapsed??0)<this.until;return {hint:this.hint&&!hidden?{kind:this.hint,text:TEXT[this.hint],dragCue:this.hint==='move'&&!this.compact,compact:this.compact}:null,seen:{...this.seen},completed:{...this.completed},travel:this.travel,skipped:this.skipped};}
}
