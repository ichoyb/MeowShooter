import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/ui/content.generated.json';
import {NavigationModel} from '../src/ui/model';
import {renderPage} from '../src/ui/pages';
import {hudMarkup,r1HUDValues} from '../src/ui/hud';
import {homeAudioState} from '../src/ui/r1-home';

test('R1 home has one full loadout button with the current cat and its weapon',()=>{
 const m=new NavigationModel(false,true);m.page.context.firstLevel=true;
 const p=renderPage(m,data,null);
 assert.equal(p.r1Home,true);assert.match(p.body,/<h1[^>]*>猫咪<br/);
 for(const action of ['select','settings','sound-toggle:music'])assert.match(p.body,new RegExp('data-action="'+action+'"'));
 const card=p.body.match(/<button[^>]*data-action="select"[^>]*>[\s\S]*?<\/button>/)?.[0]??'';
 assert.match(card,/aria-label="换猫，当前橘团"/);
 assert.match(card,/data-ui-asset="CAT01.png"/);
 assert.match(card,/<strong>橘团<\/strong>.*铃铛弹射器.*换猫/);
 assert.doesNotMatch(p.body,/data-action="detail:W01"/);
 for(const action of ['start','book','help'])assert.match(p.footer,new RegExp('data-action="'+action+'"'));
 assert.match(p.body,/试玩版 · 三猫开放 · 不保存进度/);assert.doesNotMatch(p.body,/loadout-card|hero-weapon|内部试玩：/);
 let depth=0;for(const tag of p.body.matchAll(/<\/?button\b[^>]*>/g)){depth+=tag[0].startsWith('</')?-1:1;assert(depth>=0&&depth<=1,'buttons must be independent');}assert.equal(depth,0);
 for(const model of [new NavigationModel(),new NavigationModel(true,false)]){
  model.page.context.firstLevel=true;assert.equal(renderPage(model,data,null).r1Home,undefined);
 }
 m.page.context.sample=true;assert.equal(renderPage(m,data,null).r1Home,undefined);
 m.page.context.sample=false;m.page.context.firstLevel=false;assert.equal(renderPage(m,data,null).r1Home,undefined);
});
test('R1 HUD reads real health, XP, timer and ammo without restoring old controls',()=>{
 const s={hp:71,maxHp:90,elapsed:61,durationSeconds:600,ammo:3,ammoCapacity:12,reloadLeft:0,progression:{level:4,xp:7,nextXP:20},encounter:null};
 const p=hudMarkup(s,false,1,false,'橘团 · 铃铛弹射器',true);
 assert.match(p,/生命/);assert.match(p,/id="health">71 \/ 90/);assert.match(p,/id="timer">08:59/);
 assert.match(p,/id="ammo"[^>]*>弹药 3 \/ 12/);assert.match(p,/id="level">Lv\. 4/);
 assert.match(p,/aria-label="升级经验"[^>]*aria-valuemax="20"[^>]*aria-valuenow="7"/);
 assert.match(p,/id="survival-progress"[^>]*width:35%/);
 for(const id of ['encounter','boss-line','boss-name','boss-hp','boss-fill'])assert.match(p,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(p,/ammo-chip|mode-label|换弹按钮|自动 ·|reload-track/);
 assert.equal(r1HUDValues({...s,reloadLeft:.8}).ammo,'装填中 · 0 / 12');
 assert.doesNotMatch(hudMarkup(s,true,1,false,'样例',true),/r1-hud-top/);
});
test('home music preference is on before the first interaction and remains independently mutable',()=>{
 assert.deepEqual(homeAudioState({ready:false,error:'',contextState:'not-created',settings:{music:true}}),{action:'sound-toggle:music',label:'音乐开',muted:false,error:''});
 assert.deepEqual(homeAudioState({ready:true,error:'',settings:{music:true}}),{action:'sound-toggle:music',label:'音乐开',muted:false,error:''});
 assert.equal(homeAudioState({ready:true,error:'',settings:{music:false}}).label,'音乐关');
 assert.equal(homeAudioState({ready:false,error:'',contextState:'running',settings:{music:true}}).action,'sound-enable');
 const retry=homeAudioState({ready:true,error:'resume failed',settings:{music:true}});
 assert.equal(retry.action,'sound-enable');assert.equal(retry.label,'重试声音');assert.equal(retry.error,'声音暂不可用，请重试');
});
