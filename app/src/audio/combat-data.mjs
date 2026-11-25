// G5-3 adopted project-original ZzFX 1.4 parameters, 44100 Hz.
// Reviewed in the isolated 9044 audition. Runtime never imports design sources.
export const COMBAT_SOUND_SPECS = [
 {id:'fish-shot',label:'小鱼干发射 · 短飞掠',parameters:[.20,0,120,.012,.005,.075,4,1.5,-.2,0,0,0,0,.35,0,0,0,.55,.014,0,-1500]},
 {id:'bone-shot',label:'鱼骨发射 · 短闷炮',parameters:[.22,0,82,.004,.007,.115,1,1.6,-.6,0,0,0,0,.4,0,0,0,.65,.014,0,-1700]},
 {id:'critical',label:'暴击 · 温暖短鸣',parameters:[.34,0,554.37,.004,.012,.17,0,1.6,-.12,0,0,0,0,0,1.8,0,.018,.68,.012,0,-2100]},
 {id:'shield-break',label:'破盾 · 碎弧回落',parameters:[.34,0,300,.006,.025,.21,1,1.6,-1.1,0,0,0,.055,.08,0,0,0,.55,.014,.38,-1450]},
 {id:'xp',label:'经验拾取 · 轻小星点',parameters:[.15,0,740,.005,.005,.075,0,1.7,0,0,0,0,0,0,0,0,0,.55,.008,0,-2100]},
 {id:'thick',label:'厚实短击A',parameters:[.22,0,225,.003,.005,.083,1,1.4,-.4,0,0,0,0,.14,0,0,0,.62,.009,0,-1850]},
 {id:'pierce',label:'小鱼干命中 · 干脆穿刺',parameters:[.22,0,900,.003,.003,.069,4,1.8,-.3,0,0,0,0,.35,0,0,0,.55,.01,0,-2600]},
 {id:'blast',label:'鱼骨命中 · 小爆破',parameters:[.26,0,145,.004,.006,.16,4,1.6,-.5,0,0,0,0,.65,0,0,0,.6,.02,0,-1250]}
];
export const WEAPON_AUDIO = {W01:{fire:'slingshot',hit:'thick',rate:1,gain:.8},W04:{fire:'fish-shot',hit:'pierce',rate:1.06,gain:.7},W02:{fire:'bone-shot',hit:'blast',rate:.94,gain:.78}};
export const WEAPON_CRITICAL_AUDIO = {W01:'critical-bell',W04:'critical-fish',W02:'critical-bone'};
