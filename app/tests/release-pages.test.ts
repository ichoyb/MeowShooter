import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/ui/content.generated.json';
import {NavigationModel,createReviewModel} from '../src/ui/model';
import {renderPage} from '../src/ui/pages';
import {renderLayer} from '../src/ui/layers';
import {hudMarkup} from '../src/ui/hud';
const d:any=data;
test('public courtyard does not expose design review',()=>{
 const m=new NavigationModel();const p=renderPage(m,d,null);
 assert.doesNotMatch(p.footer,/data-action="review"/);assert.match(p.footer,/data-action="start"/);
});
test('internal review keeps all states and component samples',()=>{
 const m=createReviewModel(new NavigationModel());m.openPage('REVIEW');
 assert.match(renderPage(m,d,null).body,/公共组件样板/);m.home();assert.match(renderPage(m,d,null).footer,/data-action="review"/);
});
test('public locked cat card opens details instead of a dead select',()=>{
 const m=new NavigationModel();m.openPage('PAGE-03-S01');const p=renderPage(m,d,null);
 assert.doesNotMatch(p.body,/data-action="choose:CAT02"/);assert.match(p.body,/data-action="detail:CAT02"/);assert.doesNotMatch(p.body,/首胜开放/);
});
test('public book contains supported browsing categories',()=>{
 const m=new NavigationModel();m.openPage('PAGE-04-S01');const p=renderPage(m,d,null);
 assert.match(p.body,/data-action="category:猫咪"/);assert.match(p.body,/data-action="category:武器"/);assert.doesNotMatch(p.body,/data-action="category:(升级|协同)"/);
});
test('public settings has real quality control and no inactive audio widgets',()=>{
 const m=new NavigationModel();m.openLayer('LAYER-01-S02');const p=renderLayer(m,d);
 assert.match(p.body,/id="quality"/);assert.doesNotMatch(p.body,/type="range"|data-action="sample-audio:/);
});
test('public pause and result have no demonstration-only actions',()=>{
 const m=new NavigationModel();m.openPage('PAGE-06-S01',{actual:true},false);m.openLayer('LAYER-02-S01');const l=renderLayer(m,d);
 assert.doesNotMatch(l.body,/data-action="(upgrade|build)"/);m.openPage('PAGE-08-S02',{actual:true});const p=renderPage(m,d,{result:'survived',elapsed:120,kills:1,catId:'CAT01',weaponId:'W01'});
 assert.doesNotMatch(p.body,/data-action="build"|未接入/);assert.match(p.footer,/data-action="restart"/);
});
test('public HUD presents real survival progress',()=>{
 const p=hudMarkup({hp:90,maxHp:90,ammo:12,ammoCapacity:12,elapsed:12,durationSeconds:120,reloadSeconds:1.4,targetKind:'enemy'});
 assert.doesNotMatch(p,/等级成长待接入/);assert.match(p,/id="survival-progress"[^>]*width:10%/);
});
