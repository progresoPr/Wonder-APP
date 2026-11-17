/* Wonder Studio AI 5.4 — sesión persistente HttpOnly, recuperación local, cambio de cuenta. */
let csrf=null, currentUser=null, aiEnabled=false;
export const getCsrf=()=>csrf;
export const getUser=()=>currentUser;
export const hasAI=()=>aiEnabled;
export const setAIEnabled=value=>{aiEnabled=Boolean(value)};
const ACCOUNTS_KEY='wsa_accounts_53';
function knownAccounts(){try{return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||'[]').filter(x=>typeof x==='string').slice(0,12)}catch{return []}}
function saveAccount(email){try{localStorage.setItem(ACCOUNTS_KEY,JSON.stringify([email,...knownAccounts().filter(x=>x!==email)].slice(0,12)))}catch{}}
export async function apiRequest(path,options={}){
 const headers={...(options.headers||{})};
 if(csrf && options.method && !['GET','HEAD'].includes(options.method))headers['X-CSRF-Token']=csrf;
 if(options.body && !(options.body instanceof FormData) && !(options.body instanceof Blob) && !headers['Content-Type'])headers['Content-Type']='application/json';
 let res;try{res=await fetch(path,{...options,headers,credentials:'same-origin'})}catch{throw Error('El motor local no está disponible. Inicia Wonder Studio AI desde su aplicación de escritorio o INICIAR-WINDOWS.bat.')}
 let data;try{data=await res.json()}catch{throw Error('El servidor devolvió una respuesta inesperada')}
 if(!res.ok)throw Error(data.error||`Error ${res.status}`);
 return data;
}
function renderAuth(){
 const overlay=document.createElement('section');overlay.id='authOverlay';overlay.className='auth-overlay';
 overlay.innerHTML=`<div class="auth-box"><div class="auth-mark">✦</div><div class="auth-title">WONDER <span>STUDIO AI</span></div><p class="auth-note">Estudio privado en esta computadora. Tus proyectos quedan guardados por cuenta.</p>
 <div id="authError" class="auth-error" role="alert" hidden></div>
 <form id="authForm">
 <div id="authNameWrap" hidden><label for="authName">Nombre</label><input id="authName" autocomplete="name" maxlength="80"></div>
 <label for="authEmail">Correo o usuario de tu cuenta</label><input id="authEmail" type="email" autocomplete="username" placeholder="ejemplo@empresa.com" required>
 <div id="knownBox" hidden><label for="knownAccount">Cambiar a una cuenta utilizada antes</label><select id="knownAccount"></select></div>
 <div id="passwordWrap"><label for="authPassword">Contraseña</label><input id="authPassword" type="password" minlength="8" autocomplete="current-password" placeholder="Desde 8 caracteres" required></div>
 <div id="recoveryWrap" hidden><label for="recoveryCode">Código privado de recuperación</label><input id="recoveryCode" autocomplete="off" placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"><label for="newPassword">Nueva contraseña (8 caracteres mínimo)</label><input id="newPassword" minlength="8" type="password" autocomplete="new-password"></div>
 <label class="remember-option" id="rememberWrap"><input id="authRemember" type="checkbox" checked> Mantener sesión iniciada automáticamente en esta computadora</label>
 <button class="primary auth-submit" type="submit" id="authSubmit">Entrar</button></form>
 <div class="auth-actions"><button class="auth-switch" id="authSwitch" type="button">Crear cuenta</button><button class="auth-switch" id="authRecover" type="button">Recuperar contraseña</button></div>
 <p class="auth-tip">No necesitas publicar la aplicación. Si olvidas el código de una cuenta anterior, ejecuta RECUPERAR-CUENTA-WINDOWS.bat en esta PC.</p></div>`;
 document.body.append(overlay);
 const $=s=>overlay.querySelector(s),form=$('#authForm'),error=$('#authError'),button=$('#authSubmit');
 let mode='login';
 const accounts=knownAccounts();
 if(accounts.length){$('#knownBox').hidden=false;$('#knownAccount').replaceChildren(new Option('Elegir cuenta anterior…',''),...accounts.map(x=>new Option(x,x)));$('#knownAccount').onchange=e=>{if(e.target.value)$('#authEmail').value=e.target.value}}
 function setMode(next){mode=next;error.hidden=true;$('#authNameWrap').hidden=next!=='register';$('#recoveryWrap').hidden=next!=='recover';$('#passwordWrap').hidden=next==='recover';$('#rememberWrap').hidden=next==='recover';$('#authPassword').required=next!=='recover';$('#recoveryCode').required=next==='recover';$('#newPassword').required=next==='recover';$('#knownBox').hidden=next!=='login'||!accounts.length;
  $('#authPassword').autocomplete=next==='register'?'new-password':'current-password';button.textContent=next==='register'?'Crear cuenta':next==='recover'?'Restablecer contraseña':'Entrar';
  $('#authSwitch').textContent=next==='register'?'Ya tengo cuenta':'Crear cuenta';$('#authRecover').textContent=next==='recover'?'Volver al inicio':'Recuperar contraseña';
 }
 $('#authSwitch').onclick=()=>setMode(mode==='register'?'login':'register');
 $('#authRecover').onclick=()=>setMode(mode==='recover'?'login':'recover');
 return new Promise(resolve=>{
  form.onsubmit=async e=>{
   e.preventDefault();button.disabled=true;error.hidden=true;
   try{
    const email=$('#authEmail').value.trim(),password=$('#authPassword').value;
    if(mode==='recover'){
     const data=await apiRequest('/api/recovery/reset',{method:'POST',body:JSON.stringify({email,code:$('#recoveryCode').value,new_password:$('#newPassword').value})});
     showRecovery(data.new_recovery_code,'Contraseña actualizada. Conserva este nuevo código antes de iniciar sesión.',()=>{
      setMode('login');$('#authEmail').value=email;$('#authPassword').value='';
     });return;
    }
    const body={email,password,remember:$('#authRemember').checked};if(mode==='register')body.name=$('#authName').value.trim();
    const data=await apiRequest(mode==='register'?'/api/register':'/api/login',{method:'POST',body:JSON.stringify(body)});
    csrf=data.csrf;currentUser=data.user;saveAccount(email);
    if(mode==='register')showRecovery(data.recovery_code,'Guarda este código. Es la forma de recuperar tu cuenta sin usar correo externo.',()=>{overlay.remove();resolve(data.user)});
    else{overlay.remove();resolve(data.user)}
   }catch(err){error.hidden=false;error.textContent=err.message}
   finally{button.disabled=false}
  };
 });
 function showRecovery(code,intro,done){
  const box=overlay.querySelector('.auth-box');box.replaceChildren();
  box.innerHTML='<div class="auth-mark">✦</div><h2>Guarda tu código de recuperación</h2><p class="auth-note" id="recIntro"></p><div class="recovery-key" id="recKey"></div><div class="recovery-buttons"><button id="recCopy" class="secondary" type="button">Copiar código</button><button id="recDownload" class="secondary" type="button">Guardar TXT</button></div><p class="auth-tip">Se muestra una sola vez. No compartas este código; quien lo tenga podrá cambiar tu contraseña.</p><button id="recDone" class="primary auth-submit" type="button">Ya guardé mi código · Continuar</button>';
  box.querySelector('#recIntro').textContent=intro;box.querySelector('#recKey').textContent=code;
  box.querySelector('#recCopy').onclick=()=>navigator.clipboard?.writeText(code);
  box.querySelector('#recDownload').onclick=()=>{const blob=new Blob(['Wonder Studio AI - código de recuperación (privado)\n'+code+'\n'],{type:'text/plain'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='WonderStudio-codigo-recuperacion.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  box.querySelector('#recDone').onclick=()=>{if(mode==='recover'){overlay.remove();renderAuth().then(resolve)}else done()};
 }
}
export async function ensureAuth(){
 try{const response=await apiRequest('/api/session');aiEnabled=response.ai_enabled;
  if(response.user){csrf=response.csrf;currentUser=response.user;saveAccount(currentUser.email);return currentUser}
 }catch(e){console.warn('Sesión no disponible:',e.message)}
 return renderAuth();
}
export async function logout(){
 await apiRequest('/api/logout',{method:'POST',body:'{}'});csrf=null;currentUser=null;location.reload();
}
export const switchAccount=logout;
