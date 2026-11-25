'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// The proxy wraps exported APIs and observes native factories. Application
// source is loaded verbatim, including in explicit historical A/B runs.
module.exports = async function fixtureOptions(config, { outfile, plugins = [], testInputDiagnostics = false } = {}) {
  const { createBuildOptions } = await import('./build-options.mjs');
  const { buildConfig } = await import('./build-config.mjs');
  const actual = buildConfig();
  if (actual.profile !== config.profile) throw new Error('Fixture profile must match candidate profile');
  const { buildOptions } = await createBuildOptions(actual, {testInputDiagnostics});
  const app = path.resolve(__dirname, '..');
  const original = pathToFileURL(path.join(app, 'src/battle.ts')).href;
  const proxy = {
    name: 'test-only-native-observers',
    setup(builder) {
      builder.onResolve({ filter: /^\.\/battle$/ }, args => args.importer === path.join(app, 'src/main.ts') ? { path: 'battle', namespace: 'test-only-proxy' } : null);
      builder.onResolve({ filter: /^file:/ }, args => args.namespace === 'test-only-proxy' ? { path: require('node:url').fileURLToPath(args.path) } : null);
      builder.onLoad({ filter: /.*/, namespace: 'test-only-proxy' }, () => ({ loader: 'ts', resolveDir: path.join(app, 'src'), contents: `
        import * as actual from ${JSON.stringify(original)};
        import {makeRunConfig} from './combat-config';
        import {Session} from './rules';
        import Factory from 'phaser/src/gameobjects/GameObjectFactory';
        export * from ${JSON.stringify(original)};
        const w=window as any, graphics=Factory.prototype.graphics, snapshot=Session.prototype.snapshot;
        Factory.prototype.graphics=function(...args:any[]){w.fixtureArena=w.densityArena=this.scene;return graphics.apply(this,args);};
        Session.prototype.snapshot=function(...args:any[]){w.fixtureSession=w.densitySession=()=>this;return snapshot.apply(this,args);};
        w.fixtureRunConfig=w.densityRun=makeRunConfig;
        w.fixturePlace=(arena:any,group:any,x:number,fraction:number,kind:string)=>arena.isSlice()&&kind==='enemy'&&group===arena.enemies?arena.placeSliceEnemy('E01',x,arena.physics.world.bounds.height*fraction):arena.place(group,x,fraction,kind);
        w.fixturePosition=(sprite:any,x:number,y:number)=>{const body=sprite.body;body.reset(x,y);body.updateFromGameObject();body.prev.copy(body.position);body.prevFrame.copy(body.position);};
        w.fixtureCircle=(sprite:any,radius:number)=>{const body=sprite.body;body.updateFromGameObject();body.setCircle((radius===0?.5:radius*(1+Number.EPSILON))/Math.abs(sprite.scaleX));body.setOffset(sprite.width/2-body.halfWidth/Math.abs(sprite.scaleX),sprite.height/2-body.halfHeight/Math.abs(sprite.scaleY));body.updateFromGameObject();};
        export async function createBattle(...args:Parameters<typeof actual.createBattle>){const controller=await actual.createBattle(...args);w.fixtureBattle=w.densityBattle=controller;return controller;}
      ` }));
    }
  };
  return { ...buildOptions, entryPoints: [path.join(app, 'src/main.ts')], outfile, plugins: [proxy, ...plugins, ...buildOptions.plugins] };
};
