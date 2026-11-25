// Root-volley event identity only. Arcade Sprites own their references and
// release them on every recycle path; history is bounded by active shots.
export type BellVolley={id:number;references:number;shocked:boolean};
export class BellModifiers {
 private volleys=new Map<number,BellVolley>();private shocks=0;private bounces=0;
 acquire(id:number):BellVolley {let v=this.volleys.get(id);if(!v){v={id,references:0,shocked:false};this.volleys.set(id,v);}v.references++;return v;}
 release(v:BellVolley):void {if(v.references>0)v.references--;if(!v.references&&this.volleys.get(v.id)===v)this.volleys.delete(v.id);}
 shock(v:BellVolley):boolean {if(v.shocked)return false;v.shocked=true;this.shocks++;return true;}
 bounced():void {this.bounces++;}
 snapshot(){return {activeVolleys:this.volleys.size,shocks:this.shocks,bounces:this.bounces};}
}
