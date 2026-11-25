export type HuntCandidate = {
  id: number;
  x: number;
  y: number;
  hp: number;
  alive: boolean;
  kind: 'enemy' | 'object';
};

type HuntOrigin = { x: number; y: number };

function isLiveEnemyInRange(origin: HuntOrigin, candidate: HuntCandidate, range: number): boolean {
  return candidate.kind === 'enemy' && candidate.alive &&
    Number.isFinite(candidate.hp) && candidate.hp > 0 &&
    Number.isFinite(origin.x) && Number.isFinite(origin.y) &&
    Number.isFinite(candidate.x) && Number.isFinite(candidate.y) &&
    Math.hypot(candidate.x - origin.x, candidate.y - origin.y) <= range;
}

function chooseHighestHealth(
  origin: HuntOrigin,
  candidates: readonly HuntCandidate[],
  range: number,
  excludedId: number | null,
): HuntCandidate | null {
  let chosen: HuntCandidate | null = null;
  for (const candidate of candidates) {
    if (candidate.id === excludedId || !isLiveEnemyInRange(origin, candidate, range)) continue;
    if (!chosen || candidate.hp > chosen.hp ||
      (candidate.hp === chosen.hp && candidate.id < chosen.id)) chosen = candidate;
  }
  return chosen;
}

export function chooseHuntTarget(
  origin: HuntOrigin,
  candidates: readonly HuntCandidate[],
  range: number,
): HuntCandidate | null {
  return chooseHighestHealth(origin, candidates, range, null);
}

export function chooseHuntTransfer(
  origin: HuntOrigin,
  candidates: readonly HuntCandidate[],
  deadId: number,
): HuntCandidate | null {
  return chooseHighestHealth(origin, candidates, 120, deadId);
}

export function getMarkedTarget(
  origin: HuntOrigin,
  candidates: readonly HuntCandidate[],
  markedId: number | null,
  range: number,
): HuntCandidate | null {
  if (markedId === null) return null;
  return candidates.find(candidate => candidate.id === markedId &&
    isLiveEnemyInRange(origin, candidate, range)) ?? null;
}
