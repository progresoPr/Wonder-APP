/* Wonder Studio AI web store — Supabase private Storage + PostgREST with RLS per user. */
import {cloudRequest,cloudBlobRequest,getCloudUserId} from './auth.js';
const bucket='wonder-assets';
export function uid(){return crypto.randomUUID()}
export async function openDatabase(){return {kind:'supabase'};}
function owner(){const id=getCloudUserId();if(!id)throw Error('Inicia sesión primero');return id;}
export async function all(db,store){
 const result=[];let offset=0;while(true){
  const rows=await cloudRequest(`/rest/v1/wonder_records?owner_id=eq.${owner()}&store=eq.${encodeURIComponent(store)}&select=body&order=updated_at.desc&limit=500&offset=${offset}`);
  for(const item of rows)result.push(item.body);if(rows.length<500)break;offset+=rows.length;
 }
 if(store==='assets'){
  // Object URLs are local to the browser. Private files are fetched only with the user's JWT.
  for(const a of result){try{a.blob=await fetchAssetBlob(a)}catch(err){a.assetWarning=err.message}}
 }
 return result;
}
export async function put(db,store,value){
 const r={...value};if(!r.id)throw Error('Falta identificador del registro');
 if(store==='assets' && r.blob instanceof Blob){
  const mime=r.blob.type||guessMime(r.name);
  await cloudRequest(`/storage/v1/object/${bucket}/${owner()}/${encodeURIComponent(r.id)}`,{method:'POST',body:r.blob,headers:{'Content-Type':mime,'x-upsert':'true'}});
  r.type=r.type||mime;r.size=r.blob.size;
 }
 delete r.blob;delete r.assetWarning;
 await cloudRequest('/rest/v1/wonder_records?on_conflict=owner_id,store,id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({owner_id:owner(),store,id:r.id,project_id:store==='projects'?r.id:(r.project||null),body:r,updated_at:new Date().toISOString()})});
}
export async function remove(db,store,id){
 await cloudRequest(`/rest/v1/wonder_records?owner_id=eq.${owner()}&store=eq.${store}&id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
 if(store==='assets')try{await cloudRequest(`/storage/v1/object/${bucket}`,{method:'DELETE',body:JSON.stringify({prefixes:[`${owner()}/${id}`]})})}catch(e){console.warn('No se pudo eliminar el archivo remoto:',e)}
}
export async function batch(db,operations){
 // Explicit order: projects before their assets; reverse dependencies on delete.
 for(const op of operations){if(op.kind==='delete')await remove(db,op.store,op.id);else await put(db,op.store,op.value)}
}
export function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}
export function dataUrlToBlob(data){const [prefix,bytes]=data.split(',');const mime=(prefix.match(/data:(.*?);/)||[])[1]||'application/octet-stream';const b=atob(bytes),arr=new Uint8Array(b.length);for(let i=0;i<b.length;i++)arr[i]=b.charCodeAt(i);return new Blob([arr],{type:mime})}
export function guessMime(name){const e=String(name||'').toLowerCase().split('.').pop();return ({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',pdf:'application/pdf',ttf:'font/ttf',otf:'font/otf',woff:'font/woff',woff2:'font/woff2',mp4:'video/mp4',mp3:'audio/mpeg'})[e]||'application/octet-stream'}
export async function fetchAssetBlob(asset){
 if(asset.blob instanceof Blob)return asset.blob;
 return cloudBlobRequest(`/storage/v1/object/authenticated/${bucket}/${owner()}/${encodeURIComponent(asset.id)}`);
}
export function legacy41(){return Promise.resolve(null)}
