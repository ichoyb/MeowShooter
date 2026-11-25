type Rect={left:number;top:number;right:number;bottom:number;width:number;height:number};
type Viewport={width:number;height:number};
type WindowInfo={windowWidth:number;windowHeight:number;safeArea:Rect;menuButtons:{back:Rect|null;me:Rect|null;share:Rect|null}};
type HomeHost={launchOptions?:{miniToolEnv?:{buildVersion?:unknown}};miniTool?:{getWindowInfo?:()=>Promise<unknown>;getLaunchOptions?:()=>Promise<{miniToolEnv?:{buildVersion?:unknown}}>}};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
function isRect(r:any):r is Rect {
 return !!r&&['left','top','right','bottom','width','height'].every(k=>finite(r[k]))&&r.right>r.left&&r.bottom>r.top&&r.width>0&&r.height>0&&Math.abs(r.right-r.left-r.width)<.1&&Math.abs(r.bottom-r.top-r.height)<.1;
}
function isWindowInfo(value:any):value is WindowInfo {
 if(!value||!finite(value.windowWidth)||!finite(value.windowHeight)||value.windowWidth<=0||value.windowHeight<=0||!isRect(value.safeArea)||!value.menuButtons)return false;
 const safe=value.safeArea;
 if(safe.left<0||safe.top<0||safe.right>value.windowWidth||safe.bottom>value.windowHeight)return false;
 return ['back','me','share'].every(k=>{const r=value.menuButtons[k];return r===null||isRect(r)&&r.left>=0&&r.top>=0&&r.right<=value.windowWidth&&r.bottom<=value.windowHeight;});
}

// Native rectangles are container-relative logical units. The viewport,
// rather than the centered app, determines their conversion to CSS pixels.
export function nativeHomeInsets(value:unknown,viewport:Viewport,app:Rect){
 if(!isWindowInfo(value)||!isRect(app)||!finite(viewport.width)||!finite(viewport.height)||viewport.width<=0||viewport.height<=0)return null;
 const scale=viewport.width/value.windowWidth,safe=value.safeArea;
 const left=Math.max(app.left,safe.left*scale),right=Math.min(app.right,safe.right*scale);
 let top=Math.max(app.top,safe.top*scale+8);
 const bottom=Math.min(app.bottom,viewport.height,value.windowHeight*scale,safe.bottom*scale);
 for(const button of [value.menuButtons.back,value.menuButtons.me,value.menuButtons.share]){
  if(button&&button.right*scale>left&&button.left*scale<right&&button.bottom*scale>app.top&&button.top*scale<bottom)top=Math.max(top,button.bottom*scale+8);
 }
 if(right<=left||bottom<=top)return null;
 return {top:top-app.top,bottom:app.bottom-bottom,left:left-app.left,right:app.right-right};
}

// One attempt per viewport/host. CSS renders immediately; native reads never
// participate in boot completion, and stale resize responses cannot apply.
export function createHomeWindowReader(timeoutMs=1200){
 let attemptKey='',attemptHost:unknown,revision=0,validKey='',value:WindowInfo|null=null;
 return {
  current:(key:string)=>key===validKey?value:null,
  async refresh(host:HomeHost|undefined,key:string,onChange:()=>void){
   if(attemptKey===key&&attemptHost===host)return;
   attemptKey=key;attemptHost=host;const request=++revision;
   let timer:ReturnType<typeof setTimeout>|undefined,active=true;
   try{
    if(typeof host?.miniTool?.getWindowInfo!=='function')return;
    const miniTool=host.miniTool;
    const read=async()=>{
     let buildVersion=host.launchOptions?.miniToolEnv?.buildVersion;
     if(buildVersion==null&&typeof miniTool.getLaunchOptions==='function')buildVersion=(await miniTool.getLaunchOptions())?.miniToolEnv?.buildVersion;
     if(!active||request!==revision)return null;
     const build=Number(buildVersion);
     if(!Number.isFinite(build)||Math.floor(build/1000)<9490)return null;
     return miniTool.getWindowInfo!();
    };
    const response=await Promise.race([read(),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs);})]);
    if(request!==revision||!isWindowInfo(response))return;
    validKey=key;value=response;onChange();
   }catch{/* Keep the CSS area on native failure. */}
   finally{active=false;if(timer!==undefined)clearTimeout(timer);}
  }
 };
}
