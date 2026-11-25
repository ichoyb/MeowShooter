// Build-time extraction only: design files and numerical snapshots never load at runtime.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const source=require(path.join(root,'docs/ui/tools/content.cjs'));
const tokens=JSON.parse(fs.readFileSync(path.join(root,'docs/ui/TOKENS.json'),'utf8'));
const originalStates=source.csv(path.join(root,'docs/ui/STATE_MATRIX.csv')).map(r=>({stateId:r.stateId,name:r.name,pageId:r.pageId}));
if(originalStates.length!==62||new Set(originalStates.map(s=>s.stateId)).size!==62)throw Error('Expected 62 stable design states');
// Retain frozen design IDs; obsolete manual entries exist only in historical S1.
const states=originalStates.filter(s=>!['PAGE-06-S10','PAGE-06-S12'].includes(s.stateId));
const data={version:'C1-0.3.1',colors:tokens.colors,cats:source.cats,weapons:source.weapons,upgrades:source.upgrades,synergies:source.synergies,trees:source.trees,fixtures:source.fixtures,states};
const out=path.join(root,'app/src/ui/content.generated.json');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(data).replace(/沿准星/g,'沿自动攻击方向'));
console.log(JSON.stringify({status:'PREPARED',states:states.length,cats:data.cats.length,weapons:data.weapons.length,upgrades:data.upgrades.length,synergies:data.synergies.length,sha256:crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex')}));
// Fix intrinsic decode dimensions without changing vector paths or the cat art.
for(const name of ['W01','W02','W04','BALL','MAG','FIRE','FROST','SHOCK','SUMMON','GUARD','MOVE']){
 const file=path.join(root,'app/assets/ui/'+name+'.svg');
 const svg=fs.readFileSync(file,'utf8').replace(/<svg\b[^>]*>/,tag=>tag.replace(/\s(?:width|height)="[^"]*"/g,'').replace('<svg','<svg width="84" height="84"'));
 fs.writeFileSync(file,svg);
}
