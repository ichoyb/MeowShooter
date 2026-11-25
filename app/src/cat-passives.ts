import type { ChillConfig, RunConfig } from './combat-config';
import { chooseTarget, type Point, type Target } from './rules';
export type PassiveHit = { source: string; firstEnemyHit: boolean; targetKind: 'enemy' | 'object'; targetId: number; killed: boolean; position: Point };
export type ChillState = { layerEnds: number[]; frozenUntil: number; protectedUntil: number };
export function newChillState(): ChillState { return { layerEnds: [], frozenUntil: 0, protectedUntil: 0 }; }
export function stepChill(state: ChillState, now: number, config: ChillConfig): number {
  state.layerEnds = state.layerEnds.filter(end => end > now + 1e-8);
  return now + 1e-8 < state.frozenUntil ? 0 : 1 - config.slowPerLayer * state.layerEnds.length;
}
export function applyChill(state: ChillState, now: number, config: ChillConfig): boolean {
  stepChill(state, now, config);
  if (now + 1e-8 < state.protectedUntil) return false;
  if (state.layerEnds.length === config.maxLayers) state.layerEnds.shift();
  state.layerEnds.push(now + config.layerDurationSeconds);
  if (state.layerEnds.length === config.maxLayers) {
    state.layerEnds = []; state.frozenUntil = now + config.freezeSeconds; state.protectedUntil = state.frozenUntil + config.protectionSeconds;
  }
  return true;
}
export function chillSnapshot(state: ChillState, now: number, config: ChillConfig) {
  const layers = state.layerEnds.filter(end => end > now + 1e-8).length;
  const frozen = now + 1e-8 < state.frozenUntil;
  return { layers, frozen, protected: !frozen && now + 1e-8 < state.protectedUntil, speedMultiplier: frozen ? 0 : 1 - config.slowPerLayer * layers };
}
export function chillTarget(hit: PassiveHit, targets: Target[], config: ChillConfig): Target | null {
  if (!hit.killed) return targets.find(target => target.id === hit.targetId && target.alive && target.kind === 'enemy') ?? null;
  return chooseTarget(hit.position, targets.filter(target => target.kind === 'enemy' && target.id !== hit.targetId), null, config.transferRange);
}
export class CatPassives {
  private secondaryReady: boolean;
  private observedReloads = 0;
  private lastVolley = 0;
  private chillCredit = 0;
  private nextSpiritAt: number;
  private spiritFrequency = 1;
  private spiritMark: { targetId: number; damage: number } | null = null;
  private nextSpiritMarkAt = -Infinity;
  constructor(readonly config: RunConfig) { this.secondaryReady = config.passive === 'reload-secondary' && !config.openingPower; this.nextSpiritAt = config.spirit.intervalSeconds; }
  syncReloads(completions: number): void {
    if (completions <= this.observedReloads) return;
    this.observedReloads = completions;
    if (this.config.passive === 'reload-secondary' && !this.config.openingPower) this.secondaryReady = true;
  }
  onVolley(id: number, completions: number): boolean {
    this.syncReloads(completions);
    if (id <= this.lastVolley) return false;
    this.lastVolley = id;
    if (!this.secondaryReady) return false;
    this.secondaryReady = false; return true;
  }
  onHit(hit: PassiveHit): boolean {
    if (this.config.passive !== 'chill' || hit.source !== 'PRIMARY' || !hit.firstEnemyHit || hit.targetKind !== 'enemy') return false;
    this.chillCredit += this.config.chill.creditFactor * this.config.weapon.intervalSeconds / this.config.weapon.pellets;
    if (this.chillCredit + 1e-8 < this.config.chill.threshold) return false;
    this.chillCredit -= this.config.chill.threshold; return true;
  }
  setSpiritFrequency(frequency: number, now: number): void {
    if (frequency === this.spiritFrequency) return;
    const remaining = Math.max(0, this.nextSpiritAt - now);
    this.nextSpiritAt = now + remaining * this.spiritFrequency / frequency;
    this.spiritFrequency = frequency;
  }
  spiritAttack(now: number, origin: Point, targets: Target[]): Target | null {
    if (this.config.passive !== 'spirit' || now + 1e-8 < this.nextSpiritAt) return null;
    // A missed window is spent too. Neither missing targets nor long frames
    // queue attacks for a later frame.
    this.nextSpiritAt = now + this.config.spirit.intervalSeconds / this.spiritFrequency;
    return chooseTarget(origin, targets.filter(target => target.kind === 'enemy'), null, this.config.spirit.targetRange);
  }
  markSpiritHit(now: number, targetId: number, damage: number): boolean {
    const config = this.config.spiritMark;
    if (!config || damage <= 0 || now < this.nextSpiritMarkAt) return false;
    this.spiritMark = { targetId, damage: damage * config.multiplier };
    this.nextSpiritMarkAt = now + config.seconds;
    return true;
  }
  spiritMarkTarget(now: number): number | null {
    if (now >= this.nextSpiritMarkAt) this.spiritMark = null;
    return this.spiritMark?.targetId ?? null;
  }
  clearSpiritMark(targetId: number): void {
    if (this.spiritMark?.targetId === targetId) this.spiritMark = null;
  }
  consumeSpiritMark(now: number, targetId: number): number {
    if (this.spiritMarkTarget(now) !== targetId) return 0;
    const damage = this.spiritMark!.damage;
    this.clearSpiritMark(targetId);
    return damage;
  }
  snapshot() { return { kind: this.config.passive, secondaryReady: this.secondaryReady, chillCredit: this.chillCredit, nextSpiritAt: this.nextSpiritAt }; }
}
