import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const app = fileURLToPath(new URL('../', import.meta.url));
const root = path.dirname(path.resolve(app));
const output = path.resolve(process.argv[2] ?? path.join(root, '.local/outputs/courtyard-balance.xlsx'));
assert.match(output, /\.xlsx$/i, 'Output path must end in .xlsx');
const runtime = JSON.parse(await readFile(path.join(app, 'runtime-config.json'), 'utf8'));
assert(runtime.playtest?.courtyardEnabled && runtime.playtest?.combatSliceEnabled, 'Normal courtyard playtest is disabled');
const requireTool = createRequire(import.meta.url);
const labels = requireTool('../../docs/ui/tools/content.cjs');
const catalog = await readFile(path.join(root, 'docs/planning/REWARD_BALANCE.md'), 'utf8');
const rows = [...catalog.matchAll(/^\| ([A-Z]\d+) \/ \x60([^\x60]+)\x60 \| (.+?) \| .+? \| (.+?) \| .+? \| 正常池 \|\r?$/gm)];
const byId = new Map(rows.map(([, design, id, name, condition]) => [id, {design, name, condition}]));
assert.equal(byId.size, rows.length, 'Duplicate design mapping');
assert.equal(new Set(rows.map(([, design]) => design)).size, rows.length, 'Duplicate design identity');
const {outputFiles:[bundle]} = await build({define:{__DEVTOOLS__:'false'},absWorkingDir:app,entryPoints:['tools/courtyard-balance-data.ts'],
 bundle:true,platform:'node',target:'node22',format:'esm',write:false});
const fingerprint = createHash('sha256').update(bundle.contents).update(catalog)
 .update(JSON.stringify([runtime.playtest,labels.cats.map(c=>c.id),labels.weapons.map(w=>[w.id,w.name])])).digest('hex');
const {readCourtyardBalance} = await import('data:text/javascript;base64,'+Buffer.from(bundle.contents).toString('base64'));
const data = readCourtyardBalance(labels.cats.map(cat => cat.id));
assert.equal(byId.size, data.cards.length, 'Normal runtime pool and design catalog differ');
assert.equal(new Set(data.cards.map(card=>card.id)).size, data.cards.length, 'Duplicate runtime reward identity');
for (const card of data.cards) assert.equal(byId.get(card.id)?.name, card.name, 'Missing or stale design identity for '+card.id);

// The renderer is a desktop development dependency. The game and the normal build never load it.
const rendererRequire = process.env.BALANCE_NODE_MODULES
 ? createRequire(path.join(path.dirname(path.resolve(process.env.BALANCE_NODE_MODULES)), 'package.json')) : requireTool;
let renderer;
try { renderer = rendererRequire.resolve('@oai/artifact-tool'); }
catch (error) { throw new Error('Set BALANCE_NODE_MODULES to the bundled Codex node_modules folder for Excel export', {cause:error}); }
const {Workbook, SpreadsheetFile} = await import(pathToFileURL(renderer).href);
const wb = Workbook.create();
const previews = [];
const fmt = (value) => Number(value.toFixed(4));
const pct = (value) => fmt(value * 100) + '%';
const clock = (seconds) => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
const damage = (run) => fmt(run.weapon.damage * run.directDamageMultiplier);
const {profiles, xp, xpTarget, attributePlan, level, combat, stages, enemies, bubble, scatter,
 enrage, pickup, contracts, reinforcement, attributes:A, scales, numbers:N, unrankedSkills, xpDrops, samples} = data;
const names = profiles.map(p => p.name);
const weaponLabels = profiles.map(p => {
 const weapon = labels.weapons.find(w => w.id === p.base.weaponId);
 assert(weapon, 'Missing weapon label for '+p.base.weaponId);
 return p.name + ' / ' + weapon.name;
});
const typeNames = {A:'属性', C:'核心／独立能力', M:'配件', E:'进阶／融合', R:'契约'};
const enemyNames = {E01:'雾团', E03:'绕绕影', E04:'吐泡花', EL01:'雾壳队长（暂名）', B01:'雾壳巨兽'};

function sheet(name, title, subtitle, widths, headings, values, {table, previewRows=14, height=40, tall=[], centered=[]}={}){
 const page=wb.worksheets.add(name);
 const last=String.fromCharCode(64+widths.length), bottom=values.length+4;
 page.showGridLines=false;
 const pageFormat=page.getRange('A1:'+last+bottom).format;
 pageFormat.font={name:'Microsoft YaHei',size:10,color:'#19342C'};
 pageFormat.verticalAlignment='center';
 pageFormat.wrapText=true;
 widths.forEach((width,i)=>page.getRangeByIndexes(0,i,bottom,1).format.columnWidthPx=width);
 for(const [row,text,fill,color,size,rowHeight] of [[1,title,'#193D34','#FFFFFF',19,46],[2,subtitle,'#DFEDE5','#193D34',10,30]]){
  const band=page.getRange('A'+row+':'+last+row);band.merge();
  band.format.fill=fill;band.format.rowHeightPx=rowHeight;
  band.format.font={name:'Microsoft YaHei',size,bold:row===1,color};
  page.getRange('A'+row).values=[[text]];
 }
 page.getRange('A3').format.rowHeightPx=9;
 const head=page.getRange('A4:'+last+'4');
 head.values=[headings];head.format.rowHeightPx=36;
 const body=page.getRange('A5:'+last+bottom);
 assert(values.every(row=>row.length===headings.length), 'Ragged worksheet '+name);
 body.values=values;body.format.rowHeightPx=height;
 if(table){
  const t=page.tables.add('A4:'+last+bottom,true,table);t.style='TableStyleMedium4';t.showFilterButton=true;
 }else for(let i=5;i<=bottom;i+=2)page.getRange('A'+i+':'+last+i).format.fill='#F1F6F0';
 for(const [row,px] of tall)page.getRange('A'+row).format.rowHeightPx=px;
 for(const [start,end] of centered)page.getRange(start+'5:'+end+bottom).format.horizontalAlignment='center';
 head.format.fill='#25604C';head.format.font={name:'Microsoft YaHei',size:10,bold:true,color:'#FFFFFF'};
 page.freezePanes.freezeRows(4);
 previews.push({name,range:'A1:'+last+Math.min(bottom,previewRows)});
 return page;
}

const levelsToTarget=xp[xpTarget-1];
assert(levelsToTarget, 'Workbook must include the target level');
sheet('总览','猫咪开火啦 / 数值与构筑总表','正常庭院 playtest · 从当前运行配置导出', [184,461,461],
 ['主题','怎么查','当前口径'],[
  ['三猫与武器','横向比较生命、移速、单颗伤害、齐射、穿透、装填和被动。','首目标基础单颗非暴击伤害 '+profiles.map(p=>damage(p.effective)).join(' / ')+'。'],
  ['波次时间轴／敌人与招式','查普通怪时间段、并发上限、精英和 Boss 以及增援。','精英 '+level.eliteTimes.map(clock).join('、')+' 到期，Boss '+clock(level.bossAt)+' 到期，'+clock(level.duration)+' 时限。实际入场受出生点限制。'],
  ['经验与选卡／逐级经验','查掉落、吸附、每级 XP、出卡、精英奖励和结算。','第 '+xpTarget+' 次经验升级累计 '+levelsToTarget[3]+' XP。精英奖励独立。'],
  ['奖励','按类别、次数和开局资格筛选。设计ID用于查策划，运行ID用于追源码。',data.cards.length+' 个身份。开局具备资格 '+names.map((name,i)=>name+' '+data.cards.filter(c=>c.eligible[i]).length+'项').join(' / ')+'。'],
  ['构筑算式','先读各类成长的口径，再看三把武器选同一卡后的结果。','例值为零奖励或单张奖励的正常档派生。'],
  ['适用版本',profiles[0].base.rulesVersion+' / '+data.rulesVersion,'属性 '+attributePlan+'档，经验目标 '+xpTarget+'，未启用 URL 调参。'],
  ['来源指纹',fingerprint,'SHA-256 覆盖导出使用的规则、设计目录、名称及 playtest 开关。此表是生成快照。']
 ],{height:48,tall:[[10,61],[11,61]]});

const weaponStats=[
 ['初始生命',r=>r.maxHp,'HP'],['初始移速',r=>r.moveSpeed,'u/s'],
 ['显示 / 受击 / 占位',()=>[combat.displaySize,combat.previewContactRadius,combat.boundarySize].join(' / '),'u；受击为半径'],
 ['武器原始单颗伤害',r=>r.weapon.damage,'HP'],['角色主弹伤害修正',r=>r.directDamageMultiplier,'倍率'],
 ['首目标单颗非暴击',damage,'HP；不含小满被动'],
 ['原生齐射弹数',r=>r.weapon.pellets,'颗；每齐射消耗1发'],
 ['首目标整轮理论伤害',r=>fmt(damage(r)*r.weapon.pellets),'HP；全中且非暴击，不含被动'],
 ['齐射间隔',r=>fmt(r.weapon.intervalSeconds),'秒；显示到4位小数'],['弹匣容量',r=>r.weapon.ammoCapacity,'发'],
 ['基础自动装填',r=>r.weapon.reloadSeconds,'秒'],['基础索敌半径',r=>r.weapon.targetRange,'u'],
 ['总散角',r=>r.weapon.spreadDegrees,'度'],['额外穿透',r=>r.weapon.extraPierce,'个；首目标另计'],
 ['贯穿衰减',r=>r.weapon.pierceDamageMultiplier,'后续目标逐次乘算'],['弹速',r=>r.weapon.bulletSpeed,'u/s'],
 ['弹寿命',r=>r.weapon.bulletLifeSeconds,'秒'],['暴击率',()=>pct(data.crit.criticalChance),'主弹'],
 ['暴击倍率',()=>data.crit.criticalMultiplier,'主弹']
];
const passive = (r) => {
 if(r.openingPower)return '开局和实际装填后前 '+r.openingPower.volleys+' 次主齐射 ×'+r.openingPower.multiplier+'。首颗非暴击 '+fmt(damage(r)*r.openingPower.multiplier)+'。';
 if(r.passive==='chill'){
  const c=r.chill;
  return '首个命中每弹记 '+fmt(c.creditFactor*r.weapon.intervalSeconds/r.weapon.pellets)+' 寒意点，每 '+c.threshold+' 点叠层。每层减速 '+pct(c.slowPerLayer)+'、持续 '+c.layerDurationSeconds+'秒。'+c.maxLayers+'层冻结 '+c.freezeSeconds+'秒，解冻保护 '+c.protectionSeconds+'秒。寒意可转移范围 '+c.transferRange+'u，Boss 不硬冻。';
 }
 const s=r.spirit,m=r.spiritMark;
 return '星灵 '+s.intervalSeconds+'秒/发，索敌 '+s.targetRange+'u，基础 '+s.damage+'伤害、'+s.bulletSpeed+'u/s、寿命 '+s.bulletLifeSeconds+'秒。星印 '+m.seconds+'秒，主弹引爆一次，追加星灵触发伤害 ×'+m.multiplier+'。';
};
sheet('三猫与武器','三猫与三把武器','正常庭院零成长 · 右列标明口径', [182,234,234,234,248],['项目',...weaponLabels,'单位／口径'],[
 ...weaponStats.map(([label,value,unit])=>[label,...profiles.map(p=>value(p.effective)),unit]),
 ['专属被动',...profiles.map(p=>passive(p.effective)),'真实命中或装填触发。星灵不耗主弹药。']
 ],{height:31,tall:[[24,112]],centered:[['B','D']],previewRows:24});

const compressCycle=ids=>Array.from(new Set(ids),id=>id+' ×'+ids.filter(item=>item===id).length).join('　');
sheet('波次时间轴','十分钟出怪与遭遇','使用有效战斗时间 · 暂停和升级时冻结', [118,202,97,101,209,180,370],
 ['阶段','时间／触发','间隔（秒）','普通并发','敌人／循环','各怪并发 E01/E03/E04','执行说明'],[
  ['首遇',clock(0)+'–'+clock(stages[0].start),null,stages[0].cap,'E01 ×1',Object.values(stages[0].typeCaps).join(' / '),'首遇借用第一个常规槽和并发上限，首个常规槽跳过。'],
  ...stages.map(s=>['常规',clock(s.start)+'–'+clock(s.end),s.interval,s.cap,compressCycle(s.cycle),Object.values(s.typeCaps).join(' / '),'槽位可能因并发、出生点或入场规则跳过。']),
  ...level.eliteTimes.map((due,i)=>['精英 '+(i+1),clock(due),null,null,'EL01','最多 '+enemies.EL01.maxCount+' 只','排期到达后尝试出场，入场 '+level.arrival+'秒后允许攻击。']),
  ['Boss',clock(level.bossAt),null,null,'B01','最多 '+enemies.B01.maxCount+' 只','无需先击败精英，找到可用出生点后入场。'],
  ['遭遇增援','实际出生后 '+level.arrival+'秒',reinforcement.interval,null,'E01','精英各 '+reinforcement.eliteQuota+' / Boss '+reinforcement.bossQuota,reinforcement.window+'秒窗口，与普通怪共享并发。'],
  ['结算',clock(level.duration),null,null,null,null,'击败 Boss 通关。同帧死亡优先，未通关到时限则失败。']
 ],{centered:[['C','D']],previewRows:16});

const e=enemies;
const attackText={
 E01:'追逐与接触。也是首遇和遭遇增援的身份。',
 E03:'每 '+e.E03.flankSeconds+'秒重新选择侧翼，偏移 '+e.E03.flankOffset+'u；'+e.E03.closeRange+'u 内直追。',
 E04:'距离带 '+e.E04.near+'–'+e.E04.far+'u，预警 '+e.E04.warningSeconds+'秒、间隔 '+e.E04.attackInterval+'秒；泡泡伤害 '+bubble.damage+'、'+bubble.speed+'u/s、寿命 '+bubble.life+'秒、半径 '+bubble.radius+'u。',
 EL01:'起手锁向，预警 '+e.EL01.warningSeconds+'秒、冲锋 '+e.EL01.dashSpeed+'u/s × '+e.EL01.dashSeconds+'秒（'+e.EL01.dashSpeed*e.EL01.dashSeconds+'u），伤害 '+e.EL01.dashDamage+'。恢复 '+e.EL01.recovery+'秒，起手间隔 '+e.EL01.attackInterval+'秒。',
 B01:'冲锋 '+e.B01.dashSpeed+'u/s × '+e.B01.dashSeconds+'秒（'+e.B01.dashSpeed*e.B01.dashSeconds+'u），伤害 '+e.B01.dashDamage+'。拍地半径 '+e.B01.slamRadius+'u、伤害 '+e.B01.slamDamage+'。两招预警 '+e.B01.warningSeconds+'秒，恢复 '+e.B01.dashRecovery+' / '+e.B01.slamRecovery+'秒。'
};
sheet('敌人与招式','敌人、伤害与 Boss 选招','正常庭院 · 生命和移动来自关卡配置', [78,127,66,87,83,87,84,78,552],
 ['ID','名称','生命','移速(u/s)','显示(u)','受击半径(u)','接触伤害','普通 XP','攻击／行为'],[
  ...Object.entries(enemyNames).map(([id,name])=>[id,name,e[id].hp,e[id].speed,e[id].size,e[id].radius,e[id].contact,xpDrops[id],attackText[id]]),
  ['B01','选招',null,null,null,null,null,null,scatter.near+'–'+scatter.far+'u 可读、冷却完成且有足够弹槽时优先散射。其余 '+e.B01.nearRange+'u 内两招均允许时 '+pct(e.B01.slamChance)+' 拍地；更远只考虑冲锋。拍地提交后不因玩家跑出圈取消。'],
  ['B01','散射',null,null,null,null,null,null,scatter.warningSeconds+'秒预警。方向 '+scatter.angles.join('° / ')+'°，每颗 '+scatter.damage+' 伤害、'+scatter.speed+'u/s，飞到世界边界回收。'+scatter.rounds+' / '+scatter.enragedRounds+'轮，冷却 '+scatter.cooldown+' / '+scatter.enragedCooldown+'秒；轮间 '+scatter.roundGap+'秒、后轮偏 '+scatter.secondOffset+'°。'],
  ['B01','狂暴',null,null,null,null,null,null,'生命≤'+pct(enrage.hpRatio)+' 后狂暴，恢复时间 ×'+enrage.recoveryMultiplier+'。已提交的散射保留原轮数。'],
  ['共享','受击保护',null,null,null,null,null,null,'接触、冲锋、泡泡、拍地和散射共用 '+level.incomingHitIntervalSeconds+'秒命中间隔。']
 ],{height:58,tall:[[11,74]],centered:[['C','H']]});

sheet('经验与选卡','经验、选卡与结算','属性 '+attributePlan+'档 / 经验目标 '+xpTarget, [130,269,526,219],
 ['环节','当前参数','实际行为','源码模块'],[
  ['普通掉落',['E01','E03','E04'].map(id=>enemyNames[id]+' '+xpDrops[id]).join(' / '),'普通击败产生 XP。精英奖励另记，终局先于同帧 XP 开新选择。','progression-content / battle'],
  ['吸附与拾取','吸附 '+pickup.magnetRadius+'u / 拾取 '+pickup.collectRadius+'u / 吸附 '+pickup.speed+'u/s','最多 '+pickup.capacity+' 个对象，池满向近处对象合并经验。灵敏拾取每次扩大启动距离 '+pct(scales.pickup)+'。','progression-content / experience-pickups / area-ability-rules'],
  ['升级门槛','第 '+xpTarget+' 次经验升级累计 '+levelsToTarget[3]+' XP','逐级读取有效阈值，曲线继续递增。经验可以连续排队。','progression / level-config'],
  ['普通候选','优先进阶／融合、关联核心及属性','合法未拥有或可叠加的卡才参与。最终重排。','progression'],
  ['契约','至少 '+contracts.minimumPicks+' 次真实确认，有合法契约时 '+pct(contracts.offerChance)+' 放入一槽','同时检查互斥、攻击与独立来源，各卡资格见奖励页。','contract-rules / progression'],
  ['精英奖励','最多 '+level.eliteTimes.length+' 次，回复选卡后最大生命 '+pct(data.sustain.eliteHealFraction),'真实击败后入队，未打开的选择中精英优先。按选卡后最大生命计算，受实际缺血限制；满血回复 0。','sustain-rules / rules / progression']
 ],{height:56});
sheet('逐级经验','从 Lv.1 开始的逐级经验','当前经验档的运行门槛 · 最后一行是表格展示边界', [145,145,194,239],
 ['当前等级','下一级','本次所需 XP','从 Lv.1 累计 XP'],xp,{table:'ExperienceThresholds',height:28,centered:[['A','D']]});

const displayNames=s=>s.replaceAll('橘团',names[0]).replaceAll('雪团',names[1]).replaceAll('墨团',names[2]);
const rewardSources={
 A07:'area-ability-rules',A08:'area-ability-rules',A10:'area-ability-rules / progression-content',A11:'projectile-traits',A12:'projectile-traits',
 A13:'rules / player-defense-rules',A16:'sentinel-rules',C12:'sentinel-rules',C13:'player-defense-rules',C15:'area-ability-rules',
 C16:'area-ability-rules',C18:'hunt-mark',C21:'sustain-rules',C23:'weapon-bursts',M05:'battle / battle-hits',
 M10:'sustain-rules',M12:'rules / progression-content',E03:'weapon-bursts',E14:'sentinel-rules',E16:'area-ability-rules',
 E23:'battle-hits / progression-content',R04:'contract-rules',R05:'contract-rules',R06:'contract-rules',R07:'contract-rules'
};
const cardsById=new Map(data.cards.map(card=>[card.id,card]));
const cardRows=rows.map(([, ,id])=>{
 const card=cardsById.get(id);
 const meta=byId.get(card.id);
 const label=id=>byId.get(id).name;
 let requirement=meta.condition;
 if(card.requires)requirement=card.requires.map(label).join(' ＋ ');
 if(card.route)requirement=label(card.route.core)+' ＋ '+card.route.supports.map(label).join('／')+'累计 '+card.supportPicks+' 次';
 if(card.id==='A11')requirement='可暴击主弹，未到暴击率上限';
 if(['R04','R05','R06','R07'].includes(card.id))requirement=requirement.replace('4次真实确认',contracts.minimumPicks+'次真实确认');
 const eligible=names.filter((_,i)=>card.eligible[i]);
 return [meta.design,card.name,typeNames[meta.design[0]],card.id==='A11'?'最多 '+data.criticalPicks+' 次':card.limit===null?'可重复':card.limit+' 次',
  card.numeric,displayNames(requirement),eligible.length===names.length?'三猫均有':eligible.join('、')||'需前置',card.id,rewardSources[meta.design]??'progression-content / progression'];
});
sheet('50项奖励',data.cards.length+' 项正常构筑奖励','筛选类别与开局资格 · 有资格才可能参与出卡 · 源码均位于 app/src', [83,125,133,94,495,248,110,182,184],
 ['设计ID','奖励','类别','可选次数','生效数值与行为','前置／适用条件','开局资格','运行ID','主要源码模块'],cardRows,
 {table:'NormalRewards',height:62,previewRows:11});

const result=(id,measure)=>samples[id].map((p,i)=>names[i]+' '+measure(p)).join(' / ');
const defenseExample=(name,unit)=>data.defenseExamples.map((example,i)=>names[i]+' '+fmt(example[name])+unit).join(' / ');
sheet('构筑算式','构筑算式与一次选卡示例','从正常零奖励起算 · 多次同类投入先加，适用的不同桶再乘', [153,339,433,377],
 ['成长','当前算式','选一张后的结果','边界'],[
  ['力量增幅','基础值 × (1 + '+A.damage+' × 次数)',result('L1_DAMAGE',damage),'独立技能基础 '+data.skill+'→'+fmt(data.skill*(1+A.damage))+'。原生星灵不乘力量。'],
  ['攻击节奏','间隔 ÷ (1 + '+A.rate+' × 次数)',result('L1_RATE',p=>fmt(p.weapon.intervalSeconds)+'秒'),'环铃一周由 '+unrankedSkills.orbit.period+'→'+fmt(unrankedSkills.orbit.period/(1+A.rate))+'秒，同敌冷却同样除以倍率。'],
  ['灵巧装填','装填时间 ÷ (1 + '+A.reload+' × 次数)',result('L1_RELOAD',p=>fmt(p.weapon.reloadSeconds)+'秒'),'轻装弹匣再乘 '+N.lightReload+'。'],
  ['远距感知','射程 × (1 + '+A.range+' × 次数)',result('L1_RANGE',p=>fmt(p.weapon.targetRange)+'u'),'弹速不受射程成长影响。'],
  ['轻巧猫步','移速 × (1 + '+A.move+' × 次数)',result('L1_MOVE',p=>fmt(p.moveSpeed)+'u/s'),'显示、受击和世界占位独立。'],
  ['技能专精','技能伤害 × (1 + '+fmt(scales.skill)+' × 次数)','独立基础 '+data.skill+'→'+fmt(data.skill*(1+scales.skill))+'；星灵 '+unrankedSkills.spirit+'→'+fmt(unrankedSkills.spirit*(1+scales.skill)),'独立技能通常与力量桶相乘。'],
  ['广域共振','半径 × (1 + '+fmt(scales.area)+' × 次数)','脉冲 '+unrankedSkills.pulse.radius+'→'+fmt(unrankedSkills.pulse.radius*(1+scales.area))+'u','只改变适用几何，不改变索敌。'],
  ['伙伴默契','间隔 ÷ (1 + '+fmt(scales.companion)+' × 次数)','哨卫 '+unrankedSkills.sentinel.intervalSeconds+'→'+fmt(unrankedSkills.sentinel.intervalSeconds/(1+scales.companion))+'秒','只加速哨卫和原生星灵的攻击。'],
  ['多重投射','单颗倍率 max('+N.splitDamage+', n/(n+1))',result('L1_SPLIT',p=>p.weapon.pellets+'颗 × '+damage(p)),'首目标非暴击，不含被动；一次齐射仍耗一发。'],
  ['逐敌增压','每个后续目标继续乘本弹穿透系数',result('M09',p=>p.weapon.extraPierce?('递乘 '+pct(p.weapon.pierceDamageMultiplier)):'需先选贯穿弹芯'),'听雪的原生穿透可直接满足增压前置。'],
  ['精英战利品','最大生命 × '+data.sustain.eliteHealFraction+'，受缺血量限制',defenseExample('eliteRecoveryMax','生命'),'本例采用零成长上限。选元气满满时先结算该卡，再按新生命上限算精英回复。'],
  ['坚实皮毛','受伤乘 '+data.defense.armorScale+' / ('+data.defense.armorScale+' + 护甲)','首张 +'+data.defense.armorPerRank+' 护甲，减伤 '+pct(data.firstArmorReduction)+'。','先减伤，剩余伤害由护盾和生命承受。'],
  ['能量护盾','最大生命 × '+data.defense.shieldFraction+'，首次满盾',defenseExample('shieldCapacity','盾'),'有效受击后等 '+data.defense.shieldWaitSeconds+' 秒，随后每秒恢复 '+defenseExample('shieldPerSecond','盾')+'。'],
  ['生命回路','根主弹实际扣血 × '+data.sustain.lifeDamageFraction,defenseExample('lifeCircuitCap','生命/秒'),'这一列为窗口上限，实际回复受缺血量和剩余额度限制。'],
  ['装填护罩','护盾上限 × '+pct(data.sustain.reloadShieldPercent/100),defenseExample('reloadShieldMax','盾/次'),'缺失护盾不足时按实际补盾，满盾不消费补盾冷却。'],
  ['热启动','当前武器齐射间隔 × '+N.hotStartIntervalMultiplier,defenseExample('hotStartWait','秒'),'表内为未叠射速的下一枪等待。卡面随当前射速派生。']
 ],{height:49,previewRows:20});

await mkdir(path.dirname(output), {recursive:true});
const xlsx=await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(output);
if(process.env.BALANCE_PREVIEW_DIR){
 const dir=path.resolve(process.env.BALANCE_PREVIEW_DIR);
 await mkdir(dir,{recursive:true});
 for(const {name,range} of previews){
  const image=await wb.render({sheetName:name,range,scale:1,format:'png'});
  await writeFile(path.join(dir,name+'.png'),new Uint8Array(await image.arrayBuffer()));
 }
}
console.log(JSON.stringify({output,fingerprint,rules:data.rulesVersion,cats:profiles.length,waves:stages.length,rewards:cardRows.length,xpToTarget:levelsToTarget[3]}));
