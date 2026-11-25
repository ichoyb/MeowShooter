import {createHomeWindowReader,nativeHomeInsets} from './home-window';
export {createHomeWindowReader,nativeHomeInsets} from './home-window';
const homeWindow=createHomeWindowReader();
export function readLayout(app:HTMLElement,onHomeLayoutChange?:()=>void){
 const style=getComputedStyle(document.getElementById('safe-area-probe')!);
 const top=parseFloat(style.paddingTop)||0,bottom=parseFloat(style.paddingBottom)||0,contentTop=top+56+8;
 app.style.setProperty('--content-top',contentTop+'px');app.style.setProperty('--safe-bottom',bottom+'px');
 const value={width:app.clientWidth,height:app.clientHeight,dpr:window.devicePixelRatio||1,safeTop:top,safeBottom:bottom,hostNavigation:56,gap:8,contentTop};
 app.dataset.layout=JSON.stringify(value);
 if(app.classList.contains('r1-home-shell')){
  const rect=app.getBoundingClientRect(),viewport={width:document.documentElement.clientWidth,height:document.documentElement.clientHeight};
  const key=[viewport.width,viewport.height,rect.left,rect.top,rect.width,rect.height].join(':');
  const native=nativeHomeInsets(homeWindow.current(key),viewport,rect);
  const area=native||{top:contentTop,bottom,left:0,right:0},height=Math.max(0,rect.height-area.top-area.bottom);
  for(const side of ['top','bottom','left','right'] as const)app.style.setProperty('--home-'+side,area[side]+'px');
  app.dataset.homeSize=height<440?'tight':height<560?'compact':height<680?'medium':'roomy';
  app.dataset.homeLayout=JSON.stringify({...area,height,source:native?'native-window':'css-safe-area'});
  void homeWindow.refresh((window as any).xhs,key,()=>{if(app.classList.contains('r1-home-shell')){readLayout(app,onHomeLayoutChange);onHomeLayoutChange?.();}});
 }
 return value;
}
