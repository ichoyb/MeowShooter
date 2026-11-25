import { fixedWeaponId, makeRunConfig, type RunConfig } from '../combat-config';

export type Loadout={cat:string;weapon:string};
export type View={frame:string;context:Record<string,any>;scroll:number};
export function fixedLoadout(cat:string):Loadout {
  return {cat,weapon:fixedWeaponId(cat)};
}
export class NavigationModel {
  constructor(readonly reviewEnabled=false,readonly playtestEnabled=false){
    this.unlocked=playtestEnabled&&!reviewEnabled?['CAT01','CAT02','CAT03']:['CAT01'];
  }
  committed:Loadout=fixedLoadout('CAT01'); draft:Loadout=fixedLoadout('CAT01');
  unlocked=['CAT01']; settings={quality:'标准'}; layers:View[]=[];
  run:RunConfig|null=null;
  private base:View={frame:'PAGE-02-S01',context:{},scroll:0};
  private history:View[]=[];
  get current():View {return this.layers[this.layers.length-1]||this.base;}
  get page():View {return this.base;}
  get canStartProbe(){
    try{return fixedWeaponId(this.committed.cat)===this.committed.weapon&&this.unlocked.includes(this.committed.cat)&&
      (this.playtestEnabled&&!this.reviewEnabled||this.committed.cat==='CAT01');}catch{return false;}
  }
  beginRun():RunConfig {
    if(!this.canStartProbe)throw new Error('当前猫咪尚未开放，或猫咪与自带武器配对无效。');
    this.run=makeRunConfig(this.committed.cat,this.committed.weapon,'p2-basic');return this.run;
  }
  beginSelection(){this.draft={...this.committed};}
  previewCat(cat:string){if(this.unlocked.indexOf(cat)<0)return false;this.draft=fixedLoadout(cat);return true;}
  cancelSelection(){this.draft={...this.committed};}
  confirmSelection(){
    try{if(this.unlocked.indexOf(this.draft.cat)<0||fixedWeaponId(this.draft.cat)!==this.draft.weapon)return false;
      this.committed={...this.draft};return true;}catch{return false;}
  }
  openPage(frame:string,context:Record<string,any>={},remember=true){
    if(remember)this.history.push(this.base);this.layers=[];this.base={frame,context,scroll:0};
  }
  back(){if(this.layers.length){this.closeLayer();return;}this.base=this.history.pop()||{frame:'PAGE-02-S01',context:{},scroll:0};}
  openLayer(frame:string,context:Record<string,any>={}){this.layers.push({frame,context,scroll:0});}
  closeLayer(){this.layers.pop();}
  home(){this.layers=[];this.history=[];this.run=null;this.base={frame:'PAGE-02-S01',context:{},scroll:0};}
}
export function createReviewModel(real:NavigationModel):NavigationModel {
 const review=new NavigationModel(true);
 review.committed={...real.committed};review.draft={...real.draft};
 review.unlocked=real.unlocked.slice();review.settings={...real.settings};return review;
}
