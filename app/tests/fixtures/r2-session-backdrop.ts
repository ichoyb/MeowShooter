// UI-only fixed camera reference. Never shrink the entire two-screen map into
// one screen: that would make this UI sample artificially sharper than combat.
import detail from '../../src/r1-art/courtyard-detail-v01.json';
let sources:HTMLImageElement[]=[];
export async function loadSessionBackdrop():Promise<void>{
  sources=await Promise.all(['map-overscan','map-0-0','map-0-1','courtyard-detail-v01'].map(name=>new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src='./assets/'+name+'.png';
  })));
}
export function drawSessionBackdrop(low:boolean):void{
  const host=document.getElementById('sample-battle')!;
  if(host.hidden||!sources.length)return;
  let canvas=host.querySelector('canvas');if(!canvas){canvas=document.createElement('canvas');host.appendChild(canvas);}
  const box=host.getBoundingClientRect(),density=low?1:Math.max(1,Math.min(devicePixelRatio||1,2));
  canvas.style.width='100%';canvas.style.height='100%';canvas.width=Math.round(box.width*density);canvas.height=Math.round(box.height*density);
  const ctx=canvas.getContext('2d')!,scale=canvas.width/360;ctx.scale(scale,scale);ctx.translate(-180,-360);
  ctx.drawImage(sources[0],-152,-304,1024,2048);
  for(let i=0;i<2;i++)ctx.drawImage(sources[i+1],0,-256+i*512*720/408,720,sources[i+1].naturalHeight*720/408);
  const s=1024/887;for(const r of detail.regions)ctx.drawImage(sources[3],r.atlasX,r.atlasY,r.width,r.height,-152+r.x*s,-304+r.y*s,r.width*s,r.height*s);
  host.dataset.camera=JSON.stringify({x:180,y:360,widthU:360,density,scope:'FIXED_UI_REFERENCE_NOT_REAL_BATTLE'});
}
