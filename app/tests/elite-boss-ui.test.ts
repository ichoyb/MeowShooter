import test from 'node:test';
import assert from 'node:assert/strict';
import {hudMarkup} from '../src/ui/hud';
import {renderPage} from '../src/ui/pages';
import {NavigationModel} from '../src/ui/model';
import {renderLayer} from '../src/ui/layers';
import data from '../src/ui/content.generated.json';
test('actual first-level progress exposes a numeric 600-second accessibility maximum',()=>{
 const markup=hudMarkup({hp:90,maxHp:90,durationSeconds:600,elapsed:180,ammo:12,ammoCapacity:12},false);
 assert.match(markup,/aria-valuemax="600"/);assert.doesNotMatch(markup,/\$\{duration\}/);
});
test('encounter status occupies the secondary HUD field while cat and weapon label stays intact',()=>{
 const markup=hudMarkup({hp:90,maxHp:90,durationSeconds:600,elapsed:0},false,1,false,'橘团 · 铃铛弹射器');
 assert.match(markup,/<div class="level-row"><span>橘团 · 铃铛弹射器<\/span><span id="encounter">自动射击<\/span>/);
});
test('actual Boss victory and timeout render distinct truthful results without sample rewards',()=>{
 const m=new NavigationModel(false,true);m.openPage('PAGE-08-S02',{actual:true},false);
 const probe={catId:'CAT01',weaponId:'W01',result:'cleared',durationSeconds:600,elapsed:240,kills:62};
 const clear=renderPage(m,data,probe);assert.match(clear.body,/已击败雾壳巨兽/);assert.doesNotMatch(clear.body,/样例中的新开放/);
 const timeout=renderPage(m,data,{...probe,result:'timeout',elapsed:600});assert.match(timeout.body,/未能在600秒内击败雾壳巨兽/);assert.doesNotMatch(timeout.body,/庭院守住啦/);
});
test('local first-level weapon detail uses the G7 starting fire interval',()=>{
 const m=new NavigationModel(false,true);m.page.context.firstLevel=true;m.openLayer('LAYER-03-S01',{contentId:'W01'});
 assert.match(renderLayer(m,data).body,/间隔0.68秒/);
});
