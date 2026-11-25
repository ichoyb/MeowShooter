const Circle = require('phaser/src/geom/circle/Circle');
const Line = require('phaser/src/geom/line/Line');
const ContainsPoint = require('phaser/src/geom/circle/ContainsPoint');
const GetLineToCircle = require('phaser/src/geom/intersects/GetLineToCircle');
const DistanceBetween = require('phaser/src/math/distance/DistanceBetween');
const PRIMARY = 'PRIMARY', SECONDARY = 'SECONDARY', SUMMON = 'SUMMON';

const enabled = actor => !!actor.active && !!actor.body?.enable;
// Only Arcade-authorized bodies enter the geometric path ordering. The circle
// comes from the same world-space halfWidth used by Arcade World.intersects.
function targetMotionPadding(physics) {
  let padding = 0;
  physics.world.bodies.iterate(body => {
    const target = body.gameObject, kind = target?.getData('kind');
    if (target && enabled(target) && (kind === 'enemy' || kind === 'object')) {
      padding = Math.max(padding, body.deltaAbsX(), body.deltaAbsY());
    }
  });
  return padding;
}
function hitCandidates(projectile, physics, targetTravel = 0) {
  if (!enabled(projectile)) return [];
  const body = projectile.body, start = { x: body.prev.x + body.halfWidth, y: body.prev.y + body.halfHeight };
  const line = new Line(start.x, start.y, body.center.x, body.center.y);
  const candidates = [], targets = new Set(), overlaps = new Set();
  for (const candidateBody of physics.overlapCirc(body.center.x, body.center.y, body.halfWidth, true, false)) {
    const target = candidateBody.gameObject, kind = target?.getData('kind');
    if (kind === 'enemy' || kind === 'object') { targets.add(target); overlaps.add(target); }
  }
  if (line.x1 !== line.x2 || line.y1 !== line.y2 || targetTravel > 0) {
    const bodies = physics.overlapRect(Math.min(line.x1, line.x2)-targetTravel, Math.min(line.y1, line.y2)-targetTravel,
      Math.abs(line.x2 - line.x1)+2*targetTravel, Math.abs(line.y2 - line.y1)+2*targetTravel, true, false);
    for (const candidateBody of bodies) {
      const target = candidateBody.gameObject, kind = target?.getData('kind');
      if (kind === 'enemy' || kind === 'object') targets.add(target);
    }
  }
  for (const target of targets) {
    const kind = target.getData('kind');
    if (projectile.getData('effect')==='SENTRY'&&kind==='object')continue;
    if ((kind !== 'enemy' && kind !== 'object') || !enabled(target) || target.getData('hp') <= 0) continue;
    const targetBody = target.body;
    const relative = new Line(start.x-targetBody.prev.x-targetBody.halfWidth,start.y-targetBody.prev.y-targetBody.halfHeight,
      body.center.x-targetBody.center.x,body.center.y-targetBody.center.y);
    const circle = new Circle(0,0,targetBody.halfWidth), relativeStart={x:relative.x1,y:relative.y1};
    let fraction;
    if (ContainsPoint(circle,relativeStart)) fraction = 0;
    else if (relative.x1===relative.x2&&relative.y1===relative.y2) continue;
    else {
      const points = GetLineToCircle(relative, circle);
      if (!points.length) continue;
      const relativeLength=DistanceBetween(relative.x1,relative.y1,relative.x2,relative.y2);
      fraction = Math.min(...points.map(point => DistanceBetween(relative.x1,relative.y1,point.x,point.y)/relativeLength));
    }
    const distance=fraction*DistanceBetween(line.x1,line.y1,line.x2,line.y2);
    candidates.push({ target, distance, fraction, position:line.getPoint(fraction), path: overlaps.has(target) ? 'overlap' : 'sweep' });
  }
  return candidates.sort((a, b) => a.fraction - b.fraction || a.target.getData('id') - b.target.getData('id'));
}
function resolveHit(projectile, target, recycle, options = {}) {
  if (!enabled(projectile) || !enabled(target) || target.getData('hp') <= 0) return null;
  if(projectile.getData('effect')==='SENTRY'&&target.getData('kind')==='object')return null;
  const hitIds = projectile.getData('hitIds'), targetId = target.getData('id'), hitCount = projectile.getData('hitCount');
  const returning=projectile.getData('flightPhase')==='return';
  const mirror=returning&&!!projectile.getData('mirrorReturn');
  const phaseIds=mirror?projectile.getData('returnHitIds'):hitIds;
  const returnEnabled=!!projectile.getData('returnEnabled');
  const phaseCount=returning?(projectile.getData('returnHitCount')??0):hitCount;
  const ricocheted=!!projectile.getData('ricocheted'), allowance=returning?(mirror?projectile.getData('returnAllowance'):1):1+projectile.getData('extraPierce');
  if (phaseIds.has(targetId) || phaseCount >= allowance+(!returning&&ricocheted?1:0)) return null;
  const nonCriticalDamage = returning?projectile.getData('returnDamage')*Math.pow(projectile.getData('pierceDamageMultiplier'),phaseCount):ricocheted?projectile.getData('ricochetDamage'):(projectile.getData('nonCriticalDamage')??projectile.getData('damage')) * Math.pow(projectile.getData('pierceDamageMultiplier'), hitCount);
  const critical=projectile.getData('source')===PRIMARY&&projectile.getData('critical')===true;
  const targetKind=target.getData('kind');
  const targetMultiplier=projectile.getData('source')===PRIMARY&&targetKind==='enemy'?(options.primaryTargetMultiplier??1):1;
  const damage=nonCriticalDamage*(critical?projectile.getData('criticalMultiplier'):1)*targetMultiplier;
  const firstEnemyHit = projectile.getData('source') === PRIMARY && targetKind === 'enemy' && !projectile.getData('firstEnemyCredited');
  phaseIds.add(targetId); projectile.setData('hitCount', hitCount + 1);
  if(returning)projectile.setData('returnHitCount',phaseCount+1);
  else if(returnEnabled)projectile.setData('flightLastDamage',nonCriticalDamage);
  if (firstEnemyHit) projectile.setData('firstEnemyCredited', true);
  const previousHp=target.getData('hp');
  target.setData('hp', Math.max(0, previousHp - damage));
  const result = { source: projectile.getData('source'), volleyId: projectile.getData('volleyId'), projectileId: projectile.getData('projectileId'),
    effect:projectile.getData('effect'),actualDamage:previousHp-target.getData('hp'),targetId, targetKind, damage, nonCriticalDamage, critical, targetMultiplier, exhausted:phaseCount+1>=allowance, killed: target.getData('hp') <= 0, firstEnemyHit, position: { x: target.body.center.x, y: target.body.center.y } };
  if (result.exhausted && (returning || ricocheted&&!returnEnabled || !options.deferTerminal || result.source!==PRIMARY)) recycle(projectile);
  return result;
}
// Only mutate projectile-owned event state. Arcade still owns its actual path.
function beginReturn(projectile, multiplier) {
  if(!enabled(projectile)||!projectile.getData('returnEnabled')||projectile.getData('flightPhase')!=='outbound')return false;
  const last=projectile.getData('flightLastDamage')??projectile.getData('nonCriticalDamage')??projectile.getData('damage');
  projectile.setData('returnDamage',last*multiplier);projectile.setData('returnHitCount',0);projectile.setData('flightPhase','return');return true;
}
function returnStopFraction(projectile, radius) {
  if(projectile.getData('flightPhase')!=='return')return null;
  const origin=projectile.getData('flightOrigin'),body=projectile.body;
  const start={x:body.prev.x+body.halfWidth,y:body.prev.y+body.halfHeight},end=body.center;
  const circle=new Circle(origin.x,origin.y,radius);
  if(ContainsPoint(circle,start))return 0;
  const line=new Line(start.x,start.y,end.x,end.y),length=DistanceBetween(start.x,start.y,end.x,end.y);
  if(!length)return null;
  const points=GetLineToCircle(line,circle);
  return points.length?Math.min(...points.map(p=>DistanceBetween(start.x,start.y,p.x,p.y)/length)):null;
}
function secondaryRangeStopFraction(projectile) {
  if(!projectile.getData('flightOwned')||projectile.getData('source')!==SECONDARY)return null;
  // A Clock-born shot can move before its lifetime event is inserted. Keep
  // the frozen straight reach using official geometry, without a second clock.
  const origin=projectile.getData('flightOrigin'),body=projectile.body,radius=projectile.getData('flightSpeed')*projectile.getData('flightLife');
  const circle=new Circle(origin.x,origin.y,radius),start={x:body.prev.x+body.halfWidth,y:body.prev.y+body.halfHeight};
  if(ContainsPoint(circle,body.center))return null;
  if(!ContainsPoint(circle,start))return 0;
  const line=new Line(start.x,start.y,body.center.x,body.center.y),length=DistanceBetween(start.x,start.y,body.center.x,body.center.y);
  const points=GetLineToCircle(line,circle);
  return length&&points.length?Math.min(...points.map(p=>DistanceBetween(start.x,start.y,p.x,p.y)/length)):null;
}
module.exports = { PRIMARY, SECONDARY, SUMMON, hitCandidates, resolveHit, targetMotionPadding, beginReturn, returnStopFraction, secondaryRangeStopFraction };
