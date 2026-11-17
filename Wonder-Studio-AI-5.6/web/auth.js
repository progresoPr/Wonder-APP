/* Wonder Studio AI web edition — Supabase Auth using the published (anon) key.
   Never place a Supabase service-role/secret key in this frontend. */
import {CLOUD_CONFIG as cfg} from './config.js';
let auth=null,user=null;const key='wonder_cloud_session_v1';
const base=String(cfg.url||'').replace(/\/$/,'');
const pub=String(cfg.anonKey||'');
function configured(){return /^https:\/\//.test(base) && pub.length>20}
function saved(){try{return JSON.parse(localStorage.getItem(key)||sessionStorage.getItem(key)||'null')}catch{return null}}
function retain(s,remember){localStorage.removeItem(key);sessionStorage.removeItem(key);(remember?localStorage:sessionStorage).setItem(key,JSON.stringify(s));}
function clear(){auth=null;user=null;localStorage.removeItem(key);sessionStorage.removeItem(key)}
async function request(path,{method='GET',body,token,headers}={}){
 const h={'apikey':pub,'Authorization':'Bearer '+(token||auth?.access_token||pub),...(headers||{})};
 if(body&&!(body instanceof Blob)&&!(body instanceof ArrayBuffer)&&!h['Content-Type'])h['Content-Type']='application/json';
 let res;try{res=await fetch(base+path,{method,headers:h,body})}catch{throw Error('No se puede conectar a Supabase. Comprueba tu conexión a Internet.')}
 const raw=await res.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={message:raw}}
 if(!res.ok)throw Error(data.msg||data.message||data.error_description||data.error||`Error ${res.status}`);return data;
}
export {request as cloudRequest};
export async function cloudBlobRequest(path,{method='GET',body,headers={}}={}){
 const h={'apikey':pub,'Authorization':'Bearer '+(auth?.access_token||pub),...headers};
 const r=await fetch(base+path,{method,headers:h,body});
 if(!r.ok){let msg='Error de archivos '+r.status;try{const v=await r.json();msg=v.message||v.error||msg}catch{}throw Error(msg)}
 return r.blob();
}

export function getUser(){return user}
export function getCsrf(){return null}
export function hasAI(){return false}
export function setAIEnabled(){}
export function getCloudUserId(){return user?.id||null}
async function adopt(payload,remember){
 if(!payload.access_token||!payload.refresh_token)throw Error('Confirma tu correo electrónico para activar la cuenta. Revisa tu bandeja de entrada.');
 auth={access_token:payload.access_token,refresh_token:payload.refresh_token,expires_at:Math.floor(Date.now()/1000)+(payload.expires_in||3600)};
 user={id:payload.user?.id,email:payload.user?.email,name:payload.user?.user_metadata?.name||payload.user?.email?.split('@')[0]||'Usuario'};
 retain(auth,remember);return user;
}
async function restore(){
 const prev=saved();if(!prev?.refresh_token)return null;
 auth=prev;
 try{
  if(!auth.expires_at||auth.expires_at<Math.floor(Date.now()/1000)+90){const r=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:auth.refresh_token})});await adopt(r,Boolean(localStorage.getItem(key)));}
  const r=await request('/auth/v1/user');user={id:r.id,email:r.email,name:r.user_metadata?.name||r.email?.split('@')[0]||'Usuario'};return user;
 }catch(e){clear();return null}
}
function authScreen(){
 return new Promise(resolve=>{
 const mask=document.createElement('div');mask.className='auth-overlay';
 mask.innerHTML=`<section class="auth-box"><div class="auth-mark">✦</div><div class="auth-title">WONDER <span>STUDIO AI</span></div><p class="auth-note">Edición web segura · tus proyectos se almacenan en tu cuenta Supabase.</p><div class="auth-error" id="cloudError" hidden></div>
 <form id="cloudLogin"><div id="cloudNameWrap" hidden><label for="cloudName">Nombre</label><input id="cloudName" autocomplete="name"></div><label for="cloudEmail">Correo electrónico</label><input id="cloudEmail" type="email" autocomplete="username" required placeholder="nombre@empresa.com"><div id="cloudPwdWrap"><label for="cloudPassword">Contraseña (8 caracteres mínimo)</label><input id="cloudPassword" type="password" minlength="8" autocomplete="current-password" required></div><label class="remember-option" id="cloudRememberWrap"><input type="checkbox" id="cloudRemember" checked> Mantener mi sesión iniciada</label><button class="primary auth-submit" id="cloudGo" type="submit">Iniciar sesión</button></form>
 <div class="auth-actions"><button class="auth-switch" id="cloudCreate">Crear cuenta</button><button class="auth-switch" id="cloudRecover">Recuperar contraseña</button></div><p class="auth-tip">Las cuentas de la versión local de escritorio no se trasladan automáticamente. Puedes importar un respaldo a esta cuenta.</p></section>`;
 document.body.append(mask);
 const $=s=>mask.querySelector(s);let mode='login';
 function setMode(next){mode=next;$('#cloudError').hidden=true;$('#cloudNameWrap').hidden=mode!=='register';$('#cloudPwdWrap').hidden=mode==='recover';$('#cloudRememberWrap').hidden=mode==='recover';$('#cloudPassword').required=mode!=='recover';$('#cloudGo').textContent=mode==='register'?'Crear cuenta':mode==='recover'?'Enviar correo de recuperación':'Iniciar sesión';$('#cloudCreate').textContent=mode==='register'?'Ya tengo cuenta':'Crear cuenta';$('#cloudRecover').textContent=mode==='recover'?'Volver al inicio':'Recuperar contraseña';}
 $('#cloudCreate').onclick=()=>setMode(mode==='register'?'login':'register');$('#cloudRecover').onclick=()=>setMode(mode==='recover'?'login':'recover');
 $('#cloudLogin').onsubmit=async e=>{e.preventDefault();$('#cloudGo').disabled=true;$('#cloudError').hidden=true;const email=$('#cloudEmail').value.trim(),pwd=$('#cloudPassword').value;
  try{
   if(mode==='recover'){await request('/auth/v1/recover',{method:'POST',body:JSON.stringify({email})});$('#cloudError').hidden=false;$('#cloudError').textContent='Revisa tu correo para restablecer la contraseña.';return;}
   if(mode==='register'){
    const r=await request('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password:pwd,data:{name:$('#cloudName').value.trim()}})});
    if(!r.access_token){$('#cloudError').hidden=false;$('#cloudError').textContent='Cuenta solicitada. Confirma el enlace que recibiste por correo y después inicia sesión.';setMode('login');$('#cloudError').hidden=false;$('#cloudError').textContent='Cuenta solicitada. Confirma el enlace enviado por correo y luego inicia sesión.';return;}
    await adopt(r,$('#cloudRemember').checked);
   } else {const r=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password:pwd})});await adopt(r,$('#cloudRemember').checked);}
   mask.remove();resolve(user);
  }catch(err){$('#cloudError').hidden=false;$('#cloudError').textContent=err.message;}finally{$('#cloudGo').disabled=false}
 };
 });
}
export async function ensureAuth(){
 if(!configured()){
  const overlay=document.createElement('div');overlay.className='auth-overlay';overlay.innerHTML=`<div class="auth-box"><div class="auth-mark">!</div><h2>Configuración necesaria</h2><p class="auth-note">La edición web necesita SUPABASE_URL y SUPABASE_ANON_KEY en las variables del proyecto Vercel. Consulta PUBLICAR-EN-VERCEL.md. No coloques una service_role key en estas variables.</p></div>`;document.body.append(overlay);
  throw Error('La versión web necesita credenciales públicas de Supabase configuradas en el build.');
 }
 const restored=await restore();if(restored)return restored;
 return authScreen();
}
export async function logout(){try{await request('/auth/v1/logout',{method:'POST'})}catch{}clear();location.reload()}
export const switchAccount=logout;
export async function apiRequest(path){
 if(path==='/api/ai/config')return {chat_ready:false,image_ready:false,vision_ready:false,can_manage:false,models:[],checkpoints:[]};
 throw Error('Este servicio solo está disponible en la edición de escritorio. La generación de IA en la web requiere un servidor remoto configurado.');
}
