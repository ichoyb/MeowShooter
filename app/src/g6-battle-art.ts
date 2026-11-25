import type Phaser from 'phaser';
import type {HeldHeroPresentation} from './held-hero-presentation';
import {G6CatPresentation,registerG6CatTextures} from './g6-cat-presentation';
import {G6HeldWalk,registerG6HeldWalkTextures} from './g6-held-walk';
import {G6RewardPresentation} from './g6-reward-presentation';
import {G6BellPresentation} from './g6-bell-presentation';
import {G6AreaPresentation} from './g6-area-presentation';
import {G6FlightRhythmPresentation} from './g6-flight-rhythm-presentation';
import {G6HuntContractPresentation} from './g6-hunt-contract-presentation';
import {courtyardBalanceRunConfig} from './level-config';
import {makeRunConfig} from './combat-config';
import g6Assets from './r1-art/g6-battle-paths.json';

export const g6BattlePaths:readonly string[]=g6Assets.map(file=>'./'+file);

export function createG6Art(scene:Phaser.Scene,held:HeldHeroPresentation,sources:ReadonlyMap<string,HTMLImageElement>){
  const [body,weapon,grip,head,snow,ink,guard,cannon,leaf,shard,spirit]=g6BattlePaths.map(path=>sources.get(path)!);
  registerG6CatTextures(scene,{body,weapon,grip,head});
  registerG6HeldWalkTextures(scene,{CAT02:snow,CAT03:ink});
  for(const [key,image] of Object.entries({guard,cannon,leaf,shard,spirit}))scene.textures.addImage('g6-'+key,image);
  return {
    cat:new G6CatPresentation(scene,courtyardBalanceRunConfig(makeRunConfig('CAT01','W01','p2-basic')).moveSpeed),
    held:new G6HeldWalk(scene,held,{
      CAT02:courtyardBalanceRunConfig(makeRunConfig('CAT02','W04','p2-basic')).moveSpeed,
      CAT03:courtyardBalanceRunConfig(makeRunConfig('CAT03','W02','p2-basic')).moveSpeed,
    }),
    rewards:new G6RewardPresentation(scene),bells:new G6BellPresentation(scene),
    areas:new G6AreaPresentation(scene),flight:new G6FlightRhythmPresentation(scene),
    huntContracts:new G6HuntContractPresentation(scene),
  };
}
export type G6Art=ReturnType<typeof createG6Art>;
