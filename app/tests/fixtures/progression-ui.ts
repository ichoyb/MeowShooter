// Controlled UI fixture only. Normal build has no scene/controller test export.
declare function require(path:string):any;
require('../../src/phaser-entry.cjs');
const factory=require('phaser/src/gameobjects/GameObjectFactory'),original=factory.prototype.graphics;
factory.prototype.graphics=function(...args:any[]){(window as any).growthTestArena=this.scene;return original.apply(this,args);};
const {Session}=require('../../src/rules'),advance=Session.prototype.advance;
Session.prototype.advance=function(...args:any[]){(window as any).growthTestSession=this;return advance.apply(this,args);};
require('../../src/main');
