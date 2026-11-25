import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {buildConfig} from './build-config.mjs';
const folder=path.resolve(process.env.APP_DIST || buildConfig().dist);
const port=Number(process.env.PORT||8777);
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; frame-src 'none'; media-src 'self'";
http.createServer((req,res)=>{
 try { const url=new URL(req.url,'http://127.0.0.1'),file=path.resolve(folder,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)); if(!file.startsWith(folder+path.sep)||!statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Content-Security-Policy':csp,'Cache-Control':'no-store'});res.end(readFileSync(file)); }
 catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Demo with local CSP harness: http://127.0.0.1:'+port));
