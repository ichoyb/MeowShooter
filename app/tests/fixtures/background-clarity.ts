// Independent source-quality inspection, never imported by the player entry.
const $=(id:string)=>document.getElementById(id)!;
declare const __BACKGROUND_COMPARISON__:{cap:number;currentTotal:number;currentMapSource:number;nativeAllResidentTotal:number;candidateTotal:number;candidateBaseCacheEstimate:number;currentMapCacheEstimate:number;artBounds:{x:number;y:number;width:number;height:number};regions:{x:number;y:number;width:number;height:number;atlasX:number;atlasY:number}[]};
const metadata=__BACKGROUND_COMPARISON__,regions=metadata.regions;
const images:Record<string,HTMLImageElement>={};
const joined:Record<string,HTMLCanvasElement>={};
const positions:Record<string,{x:number;y:number}>={north:{x:180,y:314},center:{x:360,y:720},east:{x:540,y:600},south:{x:180,y:1126},southeast:{x:540,y:1126}};
let active='A',revision=0;
function render(){
 const center=positions[($('position') as HTMLSelectElement).value],density=($('quality') as HTMLSelectElement).value==='low'?1:2;
 const width=390,height=680,worldWidth=360,worldHeight=height/width*worldWidth,scale=width*density/worldWidth;
 const left=center.x-worldWidth/2,top=center.y-worldHeight/2,art=metadata.artBounds;
 const showRegions=($('regions') as HTMLInputElement).checked;
 for(const id of ['A','B','C']){
  const canvas=$('view-'+id) as HTMLCanvasElement;canvas.width=width*density;canvas.height=height*density;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#dce8bc';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.scale(scale,scale);ctx.translate(-left,-top);
  if(id==='A')ctx.drawImage(joined.A,art.x,art.y,art.width,art.height);
  if(id==='B')ctx.drawImage(images.original,art.x,art.y,art.width,art.height);
  if(id==='C'){
   ctx.drawImage(joined.C,art.x,art.y,art.width,art.height);
   regions.forEach(r=>{const x=art.x+r.x/887*art.width,y=art.y+r.y/1774*art.height,w=r.width/887*art.width,h=r.height/1774*art.height;ctx.drawImage(images['candidate-details'],r.atlasX,r.atlasY,r.width,r.height,x,y,w,h);if(showRegions){ctx.strokeStyle='#b24f70';ctx.lineWidth=1/scale*2;ctx.strokeRect(x,y,w,h);}});
  }
 }
 revision++;
 document.body.dataset.sample=JSON.stringify({ready:true,revision,position:($('position') as HTMLSelectElement).value,quality:($('quality') as HTMLSelectElement).value,center,worldView:{left,top,width:worldWidth,height:worldHeight},canvas:{width:width*density,height:height*density},metadata,scope:'SOURCE_QUALITY_ONLY_NOT_REAL_COMBAT_OR_DEVICE_TEST'});
 $('status').textContent='同构图已就绪 · 画面宽360u · '+(density===2?'标准密度2':'低档密度1')+' · 可切换位置观察花石／地面取舍';
}
function tabs(){const mobile=innerWidth<=720;document.querySelectorAll<HTMLElement>('.card').forEach(e=>e.hidden=mobile&&e.dataset.variant!==active);document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.tab===active)));}
Promise.all(['current-0','current-1','original','candidate-base-0','candidate-base-1','candidate-details'].map(name=>new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>{images[name]=img;resolve();};img.onerror=()=>reject(Error('无法读取'+name));img.src='assets/'+name+'.png';}))).then(()=>{
 for(const [key,size,prefix] of [['A',512,'current-'],['C',448,'candidate-base-']] as const){const c=document.createElement('canvas');c.width=size;c.height=size*2;const ctx=c.getContext('2d')!;ctx.drawImage(images[prefix+'0'],0,0);ctx.drawImage(images[prefix+'1'],0,size);joined[key]=c;}
 const mb=(n:number)=>(n/1048576).toFixed(2)+'MiB';
 $('budget').innerHTML=[['A · 现行',mb(metadata.currentMapSource),mb(metadata.currentTotal)+' / 5MiB',mb(metadata.currentMapCacheEstimate)],['B · 原画参照',mb(887*1774*4),mb(metadata.nativeAllResidentTotal)+'，超预算','未接入；不建立放大地图缓存'],['C · 预算试验',mb(metadata.currentMapSource),mb(metadata.candidateTotal)+' / 5MiB',mb(metadata.candidateBaseCacheEstimate)+'，未实测Scene']].map(row=>'<tr>'+row.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('');
 render();tabs();
}).catch(e=>{$('status').textContent=String(e);document.body.dataset.error=String(e);});
for(const id of ['position','quality','regions'])$(id).addEventListener('change',()=>render());
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(e=>e.addEventListener('click',()=>{active=e.dataset.tab!;tabs();}));
window.addEventListener('resize',tabs);
