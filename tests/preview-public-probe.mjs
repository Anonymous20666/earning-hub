// Public pages only: no credentials, joining, pairing, account access or messages.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {PreviewEngine}=await import(pathToFileURL(resolve('backend/previewEngine.ts')).href);
const {previewImagePool}=await import(pathToFileURL(resolve('backend/previewPool.ts')).href);
const engine=new PreviewEngine();
const urls=['https://whatsapp.com/channel/0029VbDhb0RB4hdT1Dgr4n1Z','https://github.com/nodejs/node','https://developer.mozilla.org/en-US/','https://www.whatsapp.com/','https://example.com/','https://pappy-earnig-hub.duckdns.org/'];
try{
 for(const url of urls){const start=Date.now();try{const p=await engine.get(url);console.log(JSON.stringify({publicUrl:url,title:p.title,descriptionPresent:!!p.description,hasImage:!!p.thumbnailBase64,previewType:p.previewType,width:p.thumbnailWidth,height:p.thumbnailHeight,ms:Date.now()-start}));}catch{console.log(JSON.stringify({publicUrl:url,unavailable:true,ms:Date.now()-start}));}}
 await engine.get(urls[0]);console.log(JSON.stringify({cacheMetrics:engine.metrics,threads:[...previewImagePool.threads],noMessages:true}));
}finally{engine.close();await previewImagePool.close();}
