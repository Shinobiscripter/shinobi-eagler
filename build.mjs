import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='https://raw.githubusercontent.com/yangchuansheng/eaglerXserver/a517a364fb4d41998816acf410bc8fc6160b6c55/web-1.12/Eaglercraft_1.12_Offline_en_US.html';
const response=await fetch(source,{signal:AbortSignal.timeout(120000)});
if(!response.ok) throw Error(`Client download failed: ${response.status}`);
let html=await response.text();
if(!html.includes('window.eaglercraftXOpts = {') || !html.includes('worldsDB: "worlds"')) throw Error('Unexpected client format');
console.log('Client SHA256:',createHash('sha256').update(html).digest('hex'));
html=html.replace('<title>Eaglercraft 1.12.2</title>','<title>School Server — Play</title>')
 .replace(/<meta property="og:description"[^>]*>/,'<meta property="og:description" content="School Server friends survival">')
 .replace('worldsDB: "worlds"',`worldsDB: "shinobi_worlds",\n            lang: "en_US",\n            allowVoiceClient: false,\n            servers: [{addr:(location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/multiplayer",name:"School Server"}]`);
await mkdir('public',{recursive:true});
await writeFile('public/client.html',html);
console.log('Prepared Eaglercraft 1.12.2 browser client');
