/* Wonder Studio AI 5.0 — almacenamiento permanente en el servidor SQLite. */
import {apiRequest} from './auth.js';
export async function openDatabase(){return {kind:'server'};}
export async function all(db,store){return (await apiRequest('/api/records/'+encodeURIComponent(store))).items;}
export async function put(db,store,value){
  const record={...value};
  if(store==='assets'&&record.blob instanceof Blob){
    record.blob=(await blobToDataUrl(record.blob)).split(',')[1];
    record.blobType=guessMime(value.name);
  }else delete record.blob;
  await apiRequest('/api/records/'+store+'/'+encodeURIComponent(value.id),{method:'PUT',body:JSON.stringify(record)});
}
export async function remove(db,store,id){await apiRequest('/api/records/'+store+'/'+encodeURIComponent(id),{method:'DELETE'});}
export async function batch(db,operations){
  const items=[];
  // Import progress and avoid huge in-memory aggregate requests.
  for(const op of operations){
    if(op.kind==='delete'){items.push(op);continue;}
    let value={...op.value};
    if(op.store==='assets'&&value.blob instanceof Blob){value.blob=(await blobToDataUrl(value.blob)).split(',')[1];value.blobType=guessMime(value.name);}
    else delete value.blob;
    items.push({...op,value});
  }
  // Project records precede dependent assets/designs. Split into chunks with a sensible body limit.
  let chunk=[],bytes=0;
  const push=async()=>{if(chunk.length){await apiRequest('/api/batch',{method:'POST',body:JSON.stringify({operations:chunk})});chunk=[];bytes=0;}};
  for(const item of items){const size=JSON.stringify(item).length;
    if(chunk.length&&(chunk.length>=40||bytes+size>30*1024*1024))await push();
    chunk.push(item);bytes+=size;
  }
  await push();
}
export function uid(){return crypto.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
export function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(fr.error);fr.readAsDataURL(blob);});}
export function dataUrlToBlob(url){const [header,payload]=String(url).split(',');if(!payload||!header.startsWith('data:'))throw new Error('Archivo Base64 inválido');const mime=header.match(/^data:([^;]+)/)?.[1]||'application/octet-stream';const binary=atob(payload),arr=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)arr[i]=binary.charCodeAt(i);return new Blob([arr],{type:mime});}
export function guessMime(name){
  const x=String(name||'').toLowerCase();
  if(x.endsWith('.png'))return 'image/png';if(x.endsWith('.jpg')||x.endsWith('.jpeg'))return 'image/jpeg';
  if(x.endsWith('.webp'))return 'image/webp';if(x.endsWith('.gif'))return 'image/gif';
  if(x.endsWith('.svg'))return 'image/svg+xml';
  if(x.endsWith('.pdf'))return 'application/pdf';
  if(x.endsWith('.psd'))return 'image/vnd.adobe.photoshop';
  if(x.endsWith('.mp4'))return 'video/mp4';if(x.endsWith('.mov'))return 'video/quicktime';
  if(x.endsWith('.webm'))return 'video/webm';
  if(x.endsWith('.mp3'))return 'audio/mpeg';if(x.endsWith('.wav'))return 'audio/wav';
  if(x.endsWith('.ttf'))return 'font/ttf';if(x.endsWith('.otf'))return 'font/otf';if(x.endsWith('.woff'))return 'font/woff';if(x.endsWith('.woff2'))return 'font/woff2';
  return 'application/octet-stream';
}
export async function fetchAssetBlob(asset){return asset.blob instanceof Blob?asset.blob:await (async()=>{
 const response=await fetch('/api/assets/'+encodeURIComponent(asset.id)+'/file',{credentials:'same-origin'});
 if(!response.ok)throw new Error('No se pudo recuperar el recurso '+asset.name);
 return await response.blob();})();}
export function legacy41(){
  return new Promise(resolve=>{
    const req=indexedDB.open('wonder-studio-ai-v41');
    req.onerror=()=>resolve(null);
    req.onupgradeneeded=()=>{req.transaction.abort();resolve(null);};
    req.onsuccess=()=>{const db=req.result, stores=['projects','assets','designs'];
      if(!stores.every(s=>db.objectStoreNames.contains(s))){db.close();resolve(null);return;}
      const tx=db.transaction(stores,'readonly');const pending=stores.map(s=>new Promise((yes,no)=>{
        const r=tx.objectStore(s).getAll();r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error); }));
      Promise.all(pending).then(([projects,assets,designs])=>resolve({projects,assets,designs})).catch(()=>resolve(null)).finally(()=>db.close());
    };
  });
}
