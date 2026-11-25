import { makeRunConfig, type RunConfig } from './combat-config';
import {deriveGrowthConfig,GROWTH_NUMBERS as N,type GrowthRanks} from './progression';
import {DEFENSE_NUMBERS,armorPoints,armorMultiplier,shieldCapacity,shieldRecovery,type IncomingDamageFact,type DefenseSnapshot} from './player-defense-rules';
import {hpAfterMaxGrowth,hpAfterRewardRecovery,lifeCircuitLimit,lifeCircuitRecovery,reloadShieldRecovery,reloadShieldReady,type SustainHitFact,type SustainSnapshot} from './sustain-rules';
import {stanceMultiplier,MOVEMENT_CONTRACT_NUMBERS,type MovementContext} from './contract-rules';
export type {IncomingDamageFact,DefenseSnapshot} from './player-defense-rules';
export {lifeCircuitRecovery,reloadShieldRecovery,reloadShieldReady} from './sustain-rules';
export type {SustainHitFact,SustainSnapshot} from './sustain-rules';

export type Point = { x: number; y: number };
export type Target = Point & { id: number; alive: boolean; kind: 'enemy' | 'object' };
export type PauseReason = 'menu' | 'upgrade' | 'background' | 'inputLost';
export type AimProvider = () => Point | null;
export type FiredVolley = Point & { id: number; primaryMultiplier?: number };
export class Session {
  ammo: number; reloadLeft = 0; elapsed = 0; hp: number; shots = 0; reloadCompletions = 0;
  result: 'death' | 'survived' | 'cleared' | 'timeout' | null = null;
  private cooldown = 0;
  private hotStartEnabled = false;
  private hotStartRemaining = 0;
  private openingPowerRemaining: number;
  private armorRank=0;private shieldOwned=false;private shield=0;private lastEnemyAt=-Infinity;
  private absorbedTotal=0;private hpLostTotal=0;private lastHit:IncomingDamageFact|null=null;
  private recoverySettledAt=0;private recoveryFrameStart=0;
  private lifeCircuitOwned=false;private reloadShieldOwned=false;
  private lifeWindowSecond=0;private lifeUsedThisSecond=0;private hpRecoveredTotal=0;
  private shieldRecoveredTotal=0;private reloadShieldLastAt=-Infinity;private reloadStarts=0;
  private moving=false;private stationarySince:number|null=0;
  private growthRanks:GrowthRanks={L1_DAMAGE:0,L1_RATE:0,L1_HEART:0};
  effectiveConfig: RunConfig;
  private pauses = new Set<PauseReason>();
  constructor(readonly runConfig: RunConfig = makeRunConfig('CAT01', 'W01', 'diagnostic')) {
    this.effectiveConfig=runConfig; this.ammo = runConfig.weapon.ammoCapacity; this.hp = runConfig.maxHp;
    this.openingPowerRemaining = runConfig.openingPower?.volleys ?? 0;
  }
  applyGrowth(ranks: GrowthRanks): void {
    if(this.result)return;
    if(this.runConfig.movementContracts?.enabled&&ranks.R07&&!this.growthRanks.R07)this.stationarySince=this.moving?null:this.elapsed;
    const previous=this.effectiveConfig,next=deriveGrowthConfig(this.runConfig,ranks,this.movementContext());
    this.growthRanks={...ranks};
    this.cooldown*=next.weapon.intervalSeconds/previous.weapon.intervalSeconds;
    this.reloadLeft*=next.weapon.reloadSeconds/previous.weapon.reloadSeconds;
    this.hp=hpAfterMaxGrowth(this.hp,previous.maxHp,next.maxHp);
    this.ammo=Math.min(this.ammo,next.weapon.ammoCapacity);
    this.effectiveConfig=next;
    if(this.runConfig.defenseCompanions?.enabled){
      this.armorRank=ranks.A13??0;
      if(!this.shieldOwned&&(ranks.C13??0)>0){this.shieldOwned=true;this.shield=shieldCapacity(next.maxHp);this.recoverySettledAt=this.elapsed;}
      this.shield=Math.min(this.shield,this.shieldOwned?shieldCapacity(next.maxHp):0);
    }
    if(this.runConfig.projectileFlight?.enabled&&(ranks.M12??0)>0)this.hotStartEnabled=true;
    if(this.runConfig.sustainRewards?.enabled){
      this.lifeCircuitOwned=(ranks.C21??0)>0;
      this.reloadShieldOwned=(ranks.M10??0)>0;
    }
  }
  // Arena supplies the native Body's already-settled displacement. Only the
  // business state and derived damage change; HP, reload and cadence stay put.
  recordMovement(inputMovement:boolean,distance:number,ranks:GrowthRanks=this.growthRanks):void {
    if(this.isPaused||this.result||!this.runConfig.movementContracts?.enabled)return;
    const moving=inputMovement&&Number.isFinite(distance)&&distance>MOVEMENT_CONTRACT_NUMBERS.minimumDistance;
    if(moving)this.stationarySince=null;
    else if(this.moving)this.stationarySince=this.elapsed;
    this.moving=moving;
    const damage=deriveGrowthConfig(this.runConfig,ranks,this.movementContext()).weapon.damage;
    if(damage!==this.effectiveConfig.weapon.damage)this.effectiveConfig=Object.freeze({...this.effectiveConfig,weapon:Object.freeze({...this.effectiveConfig.weapon,damage})});
  }
  movementContext():MovementContext {
    return {moving:this.moving,stationarySeconds:this.stationarySince===null?0:Math.max(0,this.elapsed-this.stationarySince)};
  }
  contractSnapshot(){return {enabled:!!this.runConfig.movementContracts?.enabled,...this.movementContext(),stationarySince:this.stationarySince,stance:stanceMultiplier(this.runConfig,this.growthRanks,this.movementContext())};}
  applyGrowthReward(ranks:GrowthRanks,recoveryFraction=0):number|false {
    if(this.result||this.hp<=0)return false;
    this.applyGrowth(ranks);const before=this.hp;
    this.hp=hpAfterRewardRecovery(this.hp,this.effectiveConfig.maxHp,recoveryFraction);
    return this.hp-before;
  }
  get reasons(): PauseReason[] { return Array.from(this.pauses); }
  get isPaused(): boolean { return this.pauses.size > 0; }
  // The scene advances once, resolves that frame's physics, then step(0, aim)
  // settles death/survival before any new volley can be emitted.
  advance(delta: number): void {
    if (this.isPaused || this.result) return;
    const dt = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    this.recoveryFrameStart=this.elapsed;
    this.elapsed = Math.min(this.runConfig.durationSeconds, this.elapsed + dt);
    const second=Math.floor(this.elapsed);
    if(second!==this.lifeWindowSecond){this.lifeWindowSecond=second;this.lifeUsedThisSecond=0;}
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadLeft > 0) {
      this.reloadLeft = Math.max(0, this.reloadLeft - dt);
      if (this.reloadLeft < 1e-8) {
        this.reloadLeft = 0; this.ammo = this.effectiveConfig.weapon.ammoCapacity; this.reloadCompletions++;
        if(this.hotStartEnabled)this.hotStartRemaining=N.hotStartVolleys;
        this.openingPowerRemaining = this.runConfig.openingPower?.volleys ?? 0;
      }
    }
  }
  step(delta: number, aim: Point | null | AimProvider): FiredVolley | null {
    if (this.isPaused || this.result) return null;
    this.advance(delta);
    if (this.hp <= 0) { this.finish('death'); return null; }
    if (this.elapsed >= this.runConfig.durationSeconds) { this.finish(this.runConfig.endCondition==='boss'?'timeout':'survived'); return null; }
    if (this.reloadLeft > 0 || this.cooldown > 1e-8) return null;
    const direction = typeof aim === 'function' ? aim() : aim;
    if (!direction) return null;
    const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (length < .01 || !Number.isFinite(length)) return null;
    this.ammo--; this.shots++; this.cooldown = this.effectiveConfig.weapon.intervalSeconds;
    if(this.hotStartRemaining>0){this.hotStartRemaining--;this.cooldown*=N.hotStartIntervalMultiplier;}
    if (this.ammo === 0&&this.effectiveConfig.weapon.reloadSeconds>0) {
      this.reloadLeft = this.effectiveConfig.weapon.reloadSeconds;this.reloadStarts++;
      // The last real round starts reloading here, after this frame's enemy
      // damage. Selection, rescaling and completion never call this path.
      if(this.reloadShieldOwned&&this.shieldOwned&&reloadShieldReady(this.elapsed,this.reloadShieldLastAt)){
        const recovered=reloadShieldRecovery(this.shield,shieldCapacity(this.effectiveConfig.maxHp));
        if(recovered>0){this.shield+=recovered;this.shieldRecoveredTotal+=recovered;this.reloadShieldLastAt=this.elapsed;}
      }
    }
    const fired: FiredVolley = { id: this.shots, x: direction.x / length, y: direction.y / length };
    if (this.runConfig.openingPower && this.openingPowerRemaining > 0) {
      this.openingPowerRemaining--;
      fired.primaryMultiplier = this.runConfig.openingPower.multiplier;
    }
    return fired;
  }
  pause(reason: PauseReason): void { if (!this.result) this.pauses.add(reason); }
  resume(): void { this.pauses.delete('menu'); this.pauses.delete('background'); this.pauses.delete('inputLost'); }
  finishUpgrade(): void { this.pauses.delete('upgrade'); }
  private finish(result:NonNullable<Session['result']>):void {
    this.result=result;this.hotStartEnabled=false;this.hotStartRemaining=0;
  }
  completeBoss():void {if(!this.isPaused&&!this.result&&this.hp>0&&this.runConfig.endCondition==='boss')this.finish('cleared');}
  damage(amount: number): IncomingDamageFact {
    const rejected:IncomingDamageFact={accepted:false,rawDamage:amount,afterArmor:0,shieldAbsorbed:0,hpLost:0,shieldBroke:false};
    if(this.isPaused||this.result||this.hp<=0||!Number.isFinite(amount)||amount<=0)return rejected;
    const afterArmor=amount*armorMultiplier(this.armorRank),shieldBefore=this.shield;
    const shieldAbsorbed=Math.min(shieldBefore,afterArmor),hpBefore=this.hp;
    this.shield=Math.max(0,shieldBefore-shieldAbsorbed);
    this.hp=Math.max(0,hpBefore-(afterArmor-shieldAbsorbed));
    const hpLost=hpBefore-this.hp;
    const fact:IncomingDamageFact={accepted:true,rawDamage:amount,afterArmor,shieldAbsorbed,hpLost,shieldBroke:shieldBefore>0&&this.shield===0};
    if(shieldAbsorbed>0||hpLost>0){this.lastEnemyAt=this.elapsed;this.absorbedTotal+=shieldAbsorbed;this.hpLostTotal+=hpLost;this.lastHit=fact;}
    if(!this.hp)this.finish('death');
    return fact;
  }
  settleShieldRecovery(fromElapsed:number):number {
    if(!this.runConfig.defenseCompanions?.enabled||!this.shieldOwned||this.isPaused||this.result||this.hp<=0||!Number.isFinite(fromElapsed)||fromElapsed>this.elapsed)return 0;
    const from=Math.max(fromElapsed,this.recoverySettledAt,this.recoveryFrameStart),to=this.elapsed;
    if(to<=from)return 0;
    this.recoverySettledAt=to;
    const before=this.shield;
    this.shield=Math.min(shieldCapacity(this.effectiveConfig.maxHp),before+shieldRecovery(shieldCapacity(this.effectiveConfig.maxHp),from,to,this.lastEnemyAt));
    return this.shield-before;
  }
  defenseSnapshot():DefenseSnapshot {
    return {enabled:!!this.runConfig.defenseCompanions?.enabled,armor:armorPoints(this.armorRank),multiplier:armorMultiplier(this.armorRank),shield:this.shield,
      maxShield:this.shieldOwned?shieldCapacity(this.effectiveConfig.maxHp):0,rechargeWait:Number.isFinite(this.lastEnemyAt)?Math.max(0,this.lastEnemyAt+DEFENSE_NUMBERS.shieldWaitSeconds-this.elapsed):0,
      lastEnemyAt:Number.isFinite(this.lastEnemyAt)?this.lastEnemyAt:null,absorbedTotal:this.absorbedTotal,hpLostTotal:this.hpLostTotal,lastHit:this.lastHit?{...this.lastHit}:null};
  }
  recordSustainHit(fact:SustainHitFact):number {
    if(!this.lifeCircuitOwned||this.isPaused||this.result||this.hp<=0||fact.source!=='PRIMARY'||fact.targetKind!=='enemy'||!Number.isFinite(fact.actualDamage)||fact.actualDamage<=0)return 0;
    const recovered=lifeCircuitRecovery(fact.actualDamage,this.hp,this.effectiveConfig.maxHp,this.lifeUsedThisSecond);
    this.hp+=recovered;this.hpRecoveredTotal+=recovered;this.lifeUsedThisSecond+=recovered;
    return recovered;
  }
  sustainSnapshot():SustainSnapshot {
    const limit=lifeCircuitLimit(this.effectiveConfig.maxHp);
    return {enabled:!!this.runConfig.sustainRewards?.enabled,lifeCircuitOwned:this.lifeCircuitOwned,reloadShieldOwned:this.reloadShieldOwned,
      hpRecoveredTotal:this.hpRecoveredTotal,shieldRecoveredTotal:this.shieldRecoveredTotal,lifeWindowSecond:this.lifeWindowSecond,
      lifeUsedThisSecond:this.lifeUsedThisSecond,lifeRemainingThisSecond:Math.max(0,limit-this.lifeUsedThisSecond),lifeLimitPerSecond:limit,
      reloadShieldLastAt:Number.isFinite(this.reloadShieldLastAt)?this.reloadShieldLastAt:null,
      reloadShieldReady:reloadShieldReady(this.elapsed,this.reloadShieldLastAt),reloadStarts:this.reloadStarts};
  }
  snapshot() { return { ammo: this.ammo, ammoCapacity: this.effectiveConfig.weapon.ammoCapacity, reloadLeft: this.reloadLeft,
    reloadCompletions: this.reloadCompletions, elapsed: this.elapsed, hp: this.hp, maxHp: this.effectiveConfig.maxHp,
    catId: this.runConfig.catId, weaponId: this.runConfig.weaponId, rulesVersion: this.runConfig.rulesVersion,
    shots: this.shots, cooldown: this.cooldown, hotStartRemaining: this.hotStartRemaining, hotStartEnabled: this.hotStartEnabled,
    ...(this.runConfig.openingPower ? {openingPowerRemaining:this.openingPowerRemaining} : {}),
    reasons: this.reasons, result: this.result,defense:this.defenseSnapshot(),sustain:this.sustainSnapshot(),contracts:this.contractSnapshot() }; }
}
export class CombatCadence {
  private spawnLeft: number;
  private contactLeft = 0;
  constructor(readonly runConfig: RunConfig = makeRunConfig('CAT01', 'W01', 'diagnostic')) {
    this.spawnLeft = runConfig.scenario.spawnIntervalSeconds;
  }
  step(delta: number, session: Session): boolean {
    if (session.isPaused || session.result) return false;
    const dt = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    this.contactLeft = Math.max(0, this.contactLeft - dt);
    this.spawnLeft -= dt;
    if (this.spawnLeft > 1e-8) return false;
    this.spawnLeft = this.runConfig.scenario.spawnIntervalSeconds;
    return true;
  }
  contact(session: Session): boolean {
    if (session.isPaused || session.result || this.contactLeft > 1e-8) return false;
    this.contactLeft = this.runConfig.scenario.contactIntervalSeconds;
    session.damage(this.runConfig.scenario.contactDamage);
    return true;
  }
  reset(): void { this.spawnLeft = this.runConfig.scenario.spawnIntervalSeconds; this.contactLeft = 0; }
}
export function chooseTarget(origin: Point, targets: Target[], current: number | null, range = 240): Target | null {
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return null;
  let enemy: Target | null = null, object: Target | null = null;
  let enemyDistance = range * range, objectDistance = range * range;
  for (const t of targets) {
    if (!t.alive || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
    const d = (t.x - origin.x) ** 2 + (t.y - origin.y) ** 2;
    if (d > range * range) continue;
    const nearest = t.kind === 'enemy' ? enemy : object;
    const distance = t.kind === 'enemy' ? enemyDistance : objectDistance;
    const preferredTie = d === distance && (!nearest || t.id === current || (nearest.id !== current && t.id < nearest.id));
    if (d < distance || preferredTie) {
      if (t.kind === 'enemy') { enemy = t; enemyDistance = d; }
      else { object = t; objectDistance = d; }
    }
  }
  return enemy ?? object;
}
