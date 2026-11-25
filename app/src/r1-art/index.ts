import type Phaser from 'phaser';
import cat01Shared from './cat01-shared-atlases.json';
import atlas from './atlas.json';
import enemy_parts from './enemy-parts.json';
import h1_art from './h1-art.json';
import cat_CAT01 from './cat-CAT01.json';
import cat_CAT02 from './cat-CAT02.json';
import cat_CAT03 from './cat-CAT03.json';
export {default as r1UIMappings} from './ui-mappings.json';

// Descriptors are compiled into the classic bundle. Each packed HTMLImage is
// loaded once; multiple native Texture keys share that same decoded object.
const atlases = {
  'cat01-body-0': {image: './assets/g6-cat/body.png', data: cat01Shared.body0},
  'cat01-body-1': {image: './assets/g6-cat/body.png', data: cat01Shared.body1},
  'cat01-weapon': {image: './assets/g6-cat/weapon.png', data: cat01Shared.weapon},
  'cat01-grip': {image: './assets/g6-cat/grip.png', data: cat01Shared.grip},
  'cat01-head': {image: './assets/g6-cat/head.png', data: cat01Shared.head},
  'atlas': {image: './assets/r1-restoration/enemies.png', data: atlas},
  'enemy-parts': {image: './assets/r1-restoration/enemies.png', data: enemy_parts},
  'h1-art': {image: './assets/r1-restoration/held-weapons.png', data: h1_art},
  'cat-CAT01': {image: 'ui-CAT01.png', data: cat_CAT01},
  'cat-CAT02': {image: 'ui-CAT02.png', data: cat_CAT02},
  'cat-CAT03': {image: 'ui-CAT03.png', data: cat_CAT03}
};
export const r1BattlePaths = Array.from(new Set(Object.entries(atlases).filter(([key])=>!key.startsWith('cat-CAT')).map(([,atlas])=>atlas.image)))
  .concat('./assets/r1-restoration/native/courtyard-native-v01.png')
  .concat(['bell-hit.png','ground.png'].map(name=>'./assets/battle-feedback/'+name),['bubble.png','b01-dust.png'].map(name=>'./assets/first-combat/'+name));

export function installR1Atlases(scene: Phaser.Scene, sources: ReadonlyMap<string, HTMLImageElement>, cats: Readonly<Record<'CAT01'|'CAT02'|'CAT03',HTMLImageElement>>): void {
  for (const [key, atlas] of Object.entries(atlases)) {
    const id = key.startsWith('cat-CAT') ? key.slice(4) as keyof typeof cats : null;
    const image = id ? cats[id] : sources.get(atlas.image);
    if (!image) throw new Error('R1图集源未加载：'+key);
    scene.textures.addAtlasJSONArray(key,image,atlas.data);
  }
  scene.textures.addAtlasJSONArray('cat',cats.CAT01,cat_CAT01);
}
