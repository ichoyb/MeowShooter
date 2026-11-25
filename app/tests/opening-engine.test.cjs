const test=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{runInNewContext}=require('node:vm');
// Execute the real trimmed entry. Only unrelated browser plugin registrations
// are inert; geometry is the installed Phaser implementation, never a mock.
const engine=()=>{const scope={__BUILD_PROFILE__:'playtest',module:{exports:{}},require:id=>/phaser\/src\/(?:geom\/|math\/|curves\/|const$)/.test(id)?require(id):{}};runInNewContext(readFileSync('src/phaser-entry.cjs','utf8'),scope);return scope.module.exports;};
test('trimmed Phaser entry supplies native nearest points on both true courtyard sides',()=>{
 const P=engine();assert.equal(typeof P.Geom.Line.GetNearestPoint,'function');
 const yard=new P.Geom.Rectangle(-48,-48,816,1536),player={x:360,y:720};
 const left=P.Geom.Line.GetNearestPoint(yard.getLineD(),player),right=P.Geom.Line.GetNearestPoint(yard.getLineB(),player);
 assert.equal(left.x,-48);assert.equal(left.y,720);assert.equal(right.x,768);assert.equal(right.y,720);
 assert.equal(P.Geom.Line.GetNearestPoint,require('phaser/src/geom/line/GetNearestPoint'));
});
