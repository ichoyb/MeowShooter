// The approved score files remain the only source. The existing pinned lazy
// vendor build plugin prevents either import from constructing AudioContext.
import {renderStems as opening} from '../../../assets/audio/n1-opening-v01/score.mjs';
import {renderStems as ending} from '../../../assets/audio/n1-ending-v01/score.mjs';

export function renderChapterStems(kind) {
  const stems=kind==='opening'?opening():kind==='ending'?ending():null;
  if(!stems)throw Error('未知故事声音：'+kind);
  // Opening's legacy/candidate audition PCM is temporary and is not retained.
  return {music:stems.music,world:stems.world};
}
