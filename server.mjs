import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const port=Number(process.env.PORT||3000);
const upstreamHost=process.env.MC_HOST;
const upstreamPort=Number(process.env.MC_PORT);
const routes={'/':'index.html','/client.html':'client.html'};
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('Gateway ready');}
 if(!['GET','HEAD'].includes(req.method)||!routes[path]){res.writeHead(404);return res.end('Not found');}
 try{
  const file=fileURLToPath(new URL('./public/'+routes[path],import.meta.url));
  const info=await stat(file);
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':info.size,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':path==='/'?'no-cache':'public, max-age=3600'});
  if(req.method==='HEAD') return res.end();
  const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
 }catch{res.writeHead(503);res.end('Client is not built yet.');}
});
server.on('upgrade',(req,socket,head)=>{
 socket.on('error',()=>socket.destroy());
 if(new URL(req.url,'http://localhost').pathname!=='/multiplayer'||!upstreamHost||!Number.isInteger(upstreamPort)||upstreamPort<1||upstreamPort>65535){socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');return;}
 // The destination is fixed by the owner, never supplied by the browser.
 const headers={host:`${upstreamHost}:${upstreamPort}`,connection:'Upgrade',upgrade:'websocket'};
 for(const key of ['sec-websocket-key','sec-websocket-version','sec-websocket-protocol','sec-websocket-extensions','origin']) if(req.headers[key]) headers[key]=req.headers[key];
 const upstream=http.request({host:upstreamHost,port:upstreamPort,path:'/',method:'GET',headers});
 const timer=setTimeout(()=>upstream.destroy(Error('Backend connection timeout')),15000);
 upstream.on('upgrade',(response,remote,remoteHead)=>{
  clearTimeout(timer);
  let responseHeaders='HTTP/1.1 101 Switching Protocols\r\n';
  for(let i=0;i<response.rawHeaders.length;i+=2) responseHeaders+=`${response.rawHeaders[i]}: ${response.rawHeaders[i+1]}\r\n`;
  socket.write(responseHeaders+'\r\n');
  if(remoteHead.length) socket.write(remoteHead);
  if(head.length) remote.write(head);
  remote.on('error',()=>socket.destroy());
  socket.on('close',()=>remote.destroy());
  remote.on('close',()=>socket.destroy());
  socket.pipe(remote).pipe(socket);
 });
 upstream.on('response',response=>{clearTimeout(timer);response.resume();socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');});
 upstream.on('error',()=>{clearTimeout(timer);if(!socket.destroyed)socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');});
 socket.on('close',()=>{clearTimeout(timer);upstream.destroy();});
 upstream.end();
});
server.listen(port,'0.0.0.0',()=>console.log(`Shinobi gateway listening on ${port}`));
