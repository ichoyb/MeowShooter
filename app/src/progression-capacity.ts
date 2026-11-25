import type {RunConfig} from './combat-config';
import {companionFrequency,sentinelStats} from './sentinel-rules';
import {BATTLE_MIN_FPS} from './combat-config';
import {GROWTH_NUMBERS as N,type GrowthRanks} from './progression-content';

// Legacy non-flight configs and monotonic growth cards:
// old shots have no longer lives, more pellets or faster cadence than effective.
// This sizes the existing native Group; it owns no entities or runtime clock.
export function projectileCapacityForGrowth(base:RunConfig,effective:RunConfig,ranks:GrowthRanks):number {
 if(base.projectileFlight?.enabled)return flightProjectileCapacity(base,effective,ranks);
 const weapon=effective.weapon;
 // Session and CatPassives accept the final 1e-8s of a cooldown. Include that
 // tolerance and both lifetime endpoints, although Clock expires old shots
 // before Arena emits this frame's new volley.
 const interval=weapon.intervalSeconds-1e-8,reload=weapon.reloadSeconds-1e-8;
 const life=weapon.bulletLifeSeconds,baseMagazine=base.weapon.ammoCapacity,magazine=weapon.ammoCapacity;
 // Any V consecutive roots contain at least floor((V-1)/baseMagazine)
 // reload gaps. Using the BASE magazine preserves pre-light-magazine shots;
 // replacing it with magazine would underestimate those still-flying roots.
 const cycle=(baseMagazine-1)*interval+Math.max(interval,reload);
 const rootsIn=(window:number)=>{const cycles=Math.floor(window/cycle);return cycles*baseMagazine+Math.min(baseMagazine,Math.floor(Math.max(0,window-cycles*cycle)/interval)+1);};
 const roots=rootsIn(life);
 // A current/smaller magazine bounds tail frequency and the three opening
 // roots per reload, including partial magazines at either window endpoint.
 const tails=Math.ceil(roots/magazine),openingLength=Math.min(magazine,N.cadenceVolleys);
 const openingRoots=Math.floor(roots/magazine)*openingLength+Math.min(roots%magazine,openingLength);
 const echo=(ranks.L1_ECHO??0)>0,cadence=echo&&(ranks.L1_EVO_CADENCE??0)>0;
 const secondary=(echo?N.tailCount*tails:0)+(cadence?N.openingCount*openingRoots:effective.passive==='reload-secondary'&&!effective.openingPower?tails:0);
 // Cadence replaces orange's normal opening; its bound already covers the
 // one initial orange shot. Native CAT03 spirit shares the projectile Group.
 const spirit=companionCapacity(base,effective,ranks,false);
 // Each of the first and later native TimerEvents can round up by one
 // smoothed frame. Include those two frames beyond the nominal0.62s. The
 // shortest shipped player life(0.55s) is at least the longest single rhythm
 // timer(0.50s)+one frame: any old shot whose life expires this frame was
 // created before the due rhythm event, so Clock retires it first. No third
 // frame is needed for same-frame old lifetime retirement. The content test
 // enforces this premise; shorter-lived future content must revise the proof.
 // Current shape bounds every earlier single/sequence, while the full
 // delay window also covers old180ms events when M31/E21 is acquired. Root
 // intervals only shorten, life only grows, and the BASE magazine still
 // covers old long-magazine roots. Any R consecutive roots trigger at most
 // ceil(R/4) rhythms, each creating at most three native Group members.
 const rhythm=effective.projectileTraits?.enabled&&ranks.C23?
  Math.ceil(rootsIn(life+N.rhythmRetargetDelay+(N.rhythmSequenceCount-1)*N.rhythmSequenceStep+2/BATTLE_MIN_FPS)/N.rhythmRoots)*(ranks.L1_SPLIT&&ranks.E21?N.rhythmSequenceCount:1):0;
 const bound=roots*(weapon.pellets+Number((ranks.L1_PICKUP_CHIME??0)>0))+secondary+spirit+rhythm;
 return Math.max(24,Math.ceil(bound));
}

// Opt-in flight proof. A15 breaks the legacy monotone-lifetime premise above;
// retain every earlier speed/range shape without storing another entity list.
function flightProjectileCapacity(base:RunConfig,effective:RunConfig,ranks:GrowthRanks):number {
 const weapon=effective.weapon,frame=1/BATTLE_MIN_FPS;
 // Range only grows and V only grows from1, so every historical non-return
 // life=max(base.life, historical.range/base.speed)/V is bounded by L.
 // Pending rhythm intents keep that source life when their root is emitted.
 const life=Math.max(base.weapon.bulletLifeSeconds,weapon.targetRange/base.weapon.bulletSpeed);
 // M12 accelerates only two actual roots after each completed reload. Treat
 // every root as having that shortest interval for a conservative bound;
 // historical non-hot roots can only be farther apart. It changes no life.
 const interval=weapon.intervalSeconds*(ranks.M12?N.hotStartIntervalMultiplier:1)-1e-8,reload=weapon.reloadSeconds-1e-8;
 const baseMagazine=base.weapon.ammoCapacity,magazine=weapon.ammoCapacity;
 const cycle=(baseMagazine-1)*interval+Math.max(interval,reload);
 const rootsIn=(window:number)=>{const cycles=Math.floor(window/cycle);return cycles*baseMagazine+Math.min(baseMagazine,Math.floor(Math.max(0,window-cycles*cycle)/interval)+1);};
 // A TimerEvent may expire up to one capped Scene frame after its nominal
 // lifetime. In short-life flight content it may also follow this frame's
 // emission in Clock's insertion order. Include both endpoints and that one
 // extra frame in each window, instead of imposing a hidden minimum life.
 const primaryRoots=rootsIn(life*(ranks.M05?N.returnLife:1)+frame),secondaryRoots=rootsIn(life+frame);
 const tails=Math.ceil(secondaryRoots/magazine),openingLength=Math.min(magazine,N.cadenceVolleys);
 const openingRoots=Math.floor(secondaryRoots/magazine)*openingLength+Math.min(secondaryRoots%magazine,openingLength);
 const echo=!!ranks.L1_ECHO,cadence=echo&&!!ranks.L1_EVO_CADENCE;
 const secondary=(echo?N.tailCount*tails:0)+(cadence?N.openingCount*openingRoots:effective.passive==='reload-secondary'&&!effective.openingPower?tails:0);
 // Only PRIMARY receives2*life. Pickup, tail, opening and delayed rhythm
 // retain their frozen non-return life; native CAT03 spirit remains separate
 // in the same Group and never inherits A15 or M05.
 const spirit=companionCapacity(base,effective,ranks,true);
 // The longest root-to-last-segment path is .50+.12s. First TimerEvent and
 // later-segment TimerEvent each round up by <=one capped frame; retirement
 // can round up by another frame, even if the short-life expiry is inserted
 // after a due emission. Thus L+.62+3frames covers all frozen old intents,
 // without depending on legacy life>=.50+one-frame Clock ordering.
 const rhythm=effective.projectileTraits?.enabled&&ranks.C23?
  Math.ceil(rootsIn(life+N.rhythmRetargetDelay+(N.rhythmSequenceCount-1)*N.rhythmSequenceStep+3*frame)/N.rhythmRoots)*(ranks.L1_SPLIT&&ranks.E21?N.rhythmSequenceCount:1):0;
 return Math.max(24,Math.ceil(primaryRoots*weapon.pellets+secondaryRoots*Number(!!ranks.L1_PICKUP_CHIME)+secondary+spirit+rhythm));
}

// A16 only shortens companion intervals. Current F bounds all earlier source
// cadences, and one capped Scene frame covers native lifetime dispatch overrun.
// The disabled branch preserves the historical Group-size contract exactly.
function companionCapacity(base:RunConfig,effective:RunConfig,ranks:GrowthRanks,flight:boolean):number {
 const enabled=!!base.defenseCompanions?.enabled,F=enabled?companionFrequency(ranks):1;
 const frame=enabled||flight?1/BATTLE_MIN_FPS:0;
 const count=(life:number,interval:number)=>Math.floor((life+frame)/(interval/F-1e-8))+1;
 const spirit=effective.passive==='spirit'?count(effective.spirit.bulletLifeSeconds,effective.spirit.intervalSeconds):0;
 const stats=sentinelStats(base,ranks),sentry=enabled&&ranks.C12?count(stats.lifeSeconds,1):0;
 return spirit+sentry;
}
