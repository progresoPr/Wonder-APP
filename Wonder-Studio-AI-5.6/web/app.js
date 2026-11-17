import {createZip56} from './zip56.js';
import {askText,newProjectDialog,askConfirm,showInfo,askChoice} from './ui56.js';
import {openExportPanel56,jpegToPdf56} from './export-ui56.js';
import {openDatabase,all,put,remove,batch,uid,blobToDataUrl,dataUrlToBlob,fetchAssetBlob,guessMime,legacy41} from './storage.js';
import {ensureAuth,logout,switchAccount,apiRequest,getUser,hasAI,setAIEnabled,getCsrf} from './auth.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let chatHistory=[],lastProjectChat=null;
let localImageReady=false, localVisionReady=false;
let db, projects=[],assets=[],designs=[],currentProject=null,currentDesign=null,selectedId=null,history=[],future=[],saveTimer=null,dirty=false,saveChain=Promise.resolve(),chatStep=0,activePage='projects';
const imageUrls=new Map();
const previewableAsset=a=>['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'].includes(a.type||guessMime(a.name));
function byId(arr,id){return arr.find(x=>x.id===id)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(text){const x=$('#toast');x.textContent=text;x.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>x.classList.add('hidden'),3500);}
function status(text,kind=''){const el=$('#saveStatus');el.textContent='● '+text;el.className='status '+kind;}
function date(ms){return new Date(ms||Date.now()).toLocaleDateString('es-MX',{year:'numeric',month:'short',day:'numeric'});}
function imgUrl(asset){if(!asset)return '';if(asset.blob instanceof Blob){if(!imageUrls.has(asset.id))imageUrls.set(asset.id,URL.createObjectURL(asset.blob));return imageUrls.get(asset.id);}return '/api/assets/'+encodeURIComponent(asset.id)+'/file';}
function releaseUrl(id){if(imageUrls.has(id)){URL.revokeObjectURL(imageUrls.get(id));imageUrls.delete(id);}}
function el(tag,attrs={},children=[]){const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else e.setAttribute(k,v)}for(const c of children)e.append(c);return e;}
function defaultDesign(projectId){return {id:uid(),project:projectId,name:'Diseño nuevo',ratio:'1/1',bg:'#dceeff',layers:[{id:uid(),type:'text',text:'TU GRAN IDEA\nCOMIENZA AQUÍ',x:8,y:65,w:82,fontSize:34,color:'#13233b',font:'Arial',opacity:1,rotation:0,shadow:'none',visible:true,locked:false}],created:Date.now(),updated:Date.now(),version:1};}
function freshProject(name,description=''){return{id:uid(),name,description,created:Date.now(),logo:null};}
function snapshot(){return JSON.stringify({layers:currentDesign.layers,bg:currentDesign.bg,ratio:currentDesign.ratio});}
function markChange({record=true}={}){if(!currentDesign)return;if(record){history.push(snapshot());if(history.length>70)history.shift();future=[];}dirty=true;status('Guardando en servidor…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveCurrent().catch(console.error)},450);}
async function saveCurrent(){if(!currentDesign||!dirty)return;clearTimeout(saveTimer);const d=structuredClone(currentDesign);d.updated=Date.now();currentDesign.updated=d.updated;dirty=false;const pending=saveChain.then(()=>put(db,'designs',d));saveChain=pending.catch(()=>{});try{await pending;const i=designs.findIndex(x=>x.id===d.id);if(i>=0){if(designs[i].updated<=d.updated)designs[i]=d;}else designs.push(d);if(!dirty)status(window.WSA_WEB_MODE?'Guardado en nube':'Guardado en servidor','good');}catch(e){dirty=true;status('Error al guardar','bad');toast('No se pudo guardar: '+e.message);throw e;}}
function queueDb(action){status('Guardando en servidor…');const pending=saveChain.then(action);saveChain=pending.catch(()=>{});return pending.then(()=>status('Guardado en servidor','good')).catch(e=>{status('Error al guardar','bad');toast('Error: '+e.message);throw e;});}
async function navigate(p){if(p!==activePage&&activePage==='studio')await saveCurrent();activePage=p;$$('.page').forEach(x=>x.classList.toggle('hidden',x.id!==p+'Page'));$$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===p));if(p==='projects')renderProjects();if(p==='library'){renderLibrary();refreshLibrary55();}if(p==='designs')renderDesigns();if(p==='settings'){renderStats();renderStorage55();}if(p==='studio'){if(!currentProject){toast('Primero abre un proyecto.');return navigate('projects')}renderStudio();}}

function condenseCardActions56(card){
 const actions=card.querySelector('.cardactions');if(!actions)return;
 const secondary=[...actions.querySelectorAll('button')].filter(b=>!b.classList.contains('open'));
 if(!secondary.length)return;
 const more=document.createElement('button');more.type='button';more.textContent='⋯';more.title='Más opciones';more.setAttribute('aria-label','Más opciones');more.className='secondary card-more56';
 const pop=document.createElement('div');pop.className='card-menu56 hidden';pop.setAttribute('role','menu');
 for(const b of secondary){b.setAttribute('role','menuitem');pop.append(b)}
 more.onclick=e=>{e.stopPropagation();document.querySelectorAll('.card-menu56').forEach(x=>{if(x!==pop)x.classList.add('hidden')});pop.classList.toggle('hidden');};
 actions.append(more,pop);
}
document.addEventListener('pointerdown',e=>{for(const menu of document.querySelectorAll('.card-menu56'))if(!menu.parentElement?.contains(e.target))menu.classList.add('hidden')});

function renderProjects(){const grid=$('#projectGrid');grid.replaceChildren();if(!projects.length){grid.append(el('div',{class:'empty',text:'Todavía no tienes proyectos. Crea tu primer espacio de marca.'}));return;}for(const p of projects){const a=assets.filter(x=>x.project===p.id).length,d=designs.filter(x=>x.project===p.id).length;const c=el('div',{class:'card projectcard'});c.innerHTML=`<div><div class="project-cover56"><span class="project-monogram56">${esc((p.name||'P').slice(0,2).toUpperCase())}</span><span class="project-cover-meta56">${a} recursos · ${d} diseños</span></div><span class="pill">PROYECTO</span><h3>${esc(p.name)}</h3><p>${esc(p.description||'Identidad visual y recursos creativos')}</p></div><div><p>${a} recursos · ${d} diseños · creado ${date(p.created)}</p><div class="cardactions"><button class="primary open">Abrir estudio</button><button class="edit">Editar</button><button class="danger del">Eliminar</button></div></div>`;const logoAsset=assets.find(a=>a.project===p.id&&a.logo&&previewableAsset(a));if(logoAsset){const icon=c.querySelector('.project-monogram56');const img=document.createElement('img');img.src=imgUrl(logoAsset);img.alt='Logotipo de '+p.name;img.className='project-logo56';icon.replaceWith(img);}c.querySelector('.open').onclick=()=>openProject(p.id);c.querySelector('.edit').onclick=async()=>{const name=await newProjectDialog(p.name);if(!name?.trim())return;if(projects.some(x=>x.id!==p.id&&x.name.toLowerCase()===name.toLowerCase())){toast('Ya existe otro proyecto con ese nombre.');return;}p.name=name.trim();const desc=await askText('Descripción del proyecto',p.description||'','Descripción');if(desc!==null)p.description=desc;await queueDb(()=>put(db,'projects',p));renderProjects()};c.querySelector('.del').onclick=async()=>{if(!await askConfirm('Eliminar proyecto',`¿Eliminar definitivamente «${p.name}» con sus archivos y diseños? Exporta un respaldo antes de continuar.`,true))return;const ops=[{store:'projects',kind:'delete',id:p.id},...assets.filter(x=>x.project===p.id).map(x=>({store:'assets',kind:'delete',id:x.id})),...designs.filter(x=>x.project===p.id).map(x=>({store:'designs',kind:'delete',id:x.id}))];await queueDb(()=>batch(db,ops));assets.filter(x=>x.project===p.id).forEach(x=>releaseUrl(x.id));projects=projects.filter(x=>x.id!==p.id);assets=assets.filter(x=>x.project!==p.id);designs=designs.filter(x=>x.project!==p.id);if(currentProject?.id===p.id){currentProject=null;currentDesign=null;}renderProjects()};condenseCardActions56(c);grid.append(c);}}
async function openProject(id,designId){await saveCurrent();currentProject=byId(projects,id);if(!currentProject)return;const saved=designId?byId(designs,designId):designs.filter(x=>x.project===id).sort((a,b)=>b.updated-a.updated)[0];currentDesign=saved?structuredClone(saved):defaultDesign(id);selectedId=currentDesign.layers[0]?.id||null;history=[];future=[];if(!saved){dirty=true;await saveCurrent();}chatStep=0;chatHistory=[];$('#chatlog').replaceChildren();bot(`¡Hola! Trabajamos en ${currentProject.name}. Los recursos de su biblioteca están disponibles. ¿Qué diseño necesitas preparar?`);await navigate('studio');await loadProjectChat();await loadProjectFonts();}
function renderStudio(){if(!currentProject||!currentDesign)return;$('#studioTitle').textContent='Estudio creativo · '+currentProject.name;$('#studioSubtitle').textContent='Guardado automático en tu cuenta y servidor.';$('#designNameLabel').textContent=currentDesign.name;$('#canvasRatio').value=currentDesign.ratio;$('#bgColor').value=currentDesign.bg;renderBoard();renderStudioAssets();}
function styleTextSize(layer,boardWidth){return (layer.fontSize/470*boardWidth)+'px';}
function renderBoard(){
 if(!currentDesign)return;
 const board=$('#artboard');board.style.aspectRatio=currentDesign.ratio;board.style.background=currentDesign.bg;
 const host=$('#artElements');host.replaceChildren();
 for(const layer of currentDesign.layers){
  if(layer.visible===false)continue;
  const node=el('div',{class:'element '+layer.type+'el'+(layer.id===selectedId?' selected':'')+(layer.locked?' locked':'')});
  node.dataset.id=layer.id;node.style.left=layer.x+'%';node.style.top=layer.y+'%';node.style.width=layer.w+'%';
  node.style.height=(layer.h||(layer.type==='text'?18:layer.type==='image'?Math.max(12,layer.w*.75):18))+'%';
  node.style.opacity=layer.opacity??1;node.style.transform=`rotate(${layer.rotation||0}deg)`;
  node.style.filter=layer.shadow==='soft'?'drop-shadow(0 4px 6px #0006)':layer.shadow==='strong'?'drop-shadow(0 10px 13px #000a)':'none';
  node.style.borderRadius=(layer.radius||0)+'px';
  if(layer.strokeWidth)node.style.outline=`${layer.strokeWidth}px solid ${layer.strokeColor||'#ffffff'}`;
  if(layer.type==='text'){
   node.textContent=layer.text||'';node.style.color=layer.color||'#13233b';node.style.fontFamily=layer.font||'Arial';
   node.style.fontSize=styleTextSize(layer,board.getBoundingClientRect().width||470);node.style.fontWeight=layer.bold===false?'400':'900';
   node.style.fontStyle=layer.italic?'italic':'normal';node.style.textDecoration=[layer.underline?'underline':'',layer.strike?'line-through':''].filter(Boolean).join(' ');
   node.style.textAlign=layer.align||'left';node.style.letterSpacing=(layer.letterSpacing||0)+'px';
   if(layer.effect==='outline')node.style.webkitTextStroke='1.3px '+(layer.effectColor||'#111111');
   else if(layer.effect==='glow'||layer.effect==='neon')node.style.textShadow=`0 0 ${layer.effect==='neon'?14:7}px ${layer.effectColor||'#ef73f6'}`;
   else if(layer.effect==='echo')node.style.textShadow='3px 3px 0 #6669,6px 6px 0 #6665';
   else if(layer.effect==='shadow')node.style.textShadow='3px 5px 7px #0009';
  }else if(layer.type==='shape'){
   node.style.background=layer.color||'#6d8cff';
  }else if(layer.type==='image'){
   const a=byId(assets,layer.assetId);if(a){const im=el('img',{src:imgUrl(a),alt:a.name});
    im.style.width='100%';im.style.height='100%';im.style.objectFit=layer.fit||'contain';
    im.style.objectPosition=`${layer.cropX??50}% ${layer.cropY??50}%`;
    im.style.transform=`scale(${(layer.zoom||100)/100}) scaleX(${layer.flipH?-1:1}) scaleY(${layer.flipV?-1:1})`;
    im.style.filter=layer.imgFilter||'none';node.style.overflow='hidden';node.append(im);
   }else node.textContent='Imagen faltante';
  }
  node.addEventListener('pointerdown',ev=>dragStart(ev,layer,node));
  node.onclick=()=>selectLayer(layer.id);
  if(layer.type==='text')node.ondblclick=async()=>{const next=await askText('Editar texto',layer.text||'','Contenido');if(next!==null)modifySelected(l=>l.text=next);};
  host.append(node);
 }
 renderLayers();renderProperties();renderSelection55();
}
function renderSelection55(){
 const overlay=$('#selectionOverlay55');if(!overlay)return;
 const l=selected();if(!l||l.visible===false||l.locked){overlay.classList.add('hidden');return;}
 overlay.classList.remove('hidden');overlay.replaceChildren();
 overlay.style.left=l.x+'%';overlay.style.top=l.y+'%';overlay.style.width=l.w+'%';
 overlay.style.height=(l.h||(l.type==='text'?18:l.type==='image'?Math.max(12,l.w*.75):18))+'%';
 overlay.style.transform=`rotate(${l.rotation||0}deg)`;
 for(const handle of ['nw','n','ne','e','se','s','sw','w','rotate']){
  const b=el('span',{class:'handle55 handle-'+handle,title:handle==='rotate'?'Girar': 'Cambiar tamaño'});
  b.addEventListener('pointerdown',ev=>resizeStart55(ev,handle));overlay.append(b);
 }
 updateContext55();
}
function resizeStart55(ev,handle){
 const l=selected();if(!l||l.locked)return;
 ev.preventDefault();ev.stopPropagation();const overlay=$('#selectionOverlay55');const rect=$('#artboard').getBoundingClientRect();
 const orig={x:l.x,y:l.y,w:l.w,h:l.h||(l.type==='text'?18:Math.max(12,l.w*.75)),rotation:l.rotation||0};
 let start=JSON.stringify(orig),moved=false;const cx=orig.x/100*rect.width+orig.w/200*rect.width;
 const cy=orig.y/100*rect.height+orig.h/200*rect.height;
 const initialAngle=Math.atan2(ev.clientY-rect.top-cy,ev.clientX-rect.left-cx);
 const sx=ev.clientX,sy=ev.clientY;const target=ev.target;target.setPointerCapture(ev.pointerId);
 const move=e=>{
  const dx=(e.clientX-sx)/rect.width*100,dy=(e.clientY-sy)/rect.height*100;
  if(!moved){history.push(snapshot());future=[];moved=true;}
  if(handle==='rotate'){
   const theta=Math.atan2(e.clientY-rect.top-cy,e.clientX-rect.left-cx);
   l.rotation=Math.round(orig.rotation+(theta-initialAngle)*180/Math.PI);
  }else{
   let x=orig.x,y=orig.y,w=orig.w,h=orig.h;
   if(handle.includes('w')){x+=dx;w-=dx;}if(handle.includes('e'))w+=dx;
   if(handle.includes('n')){y+=dy;h-=dy;}if(handle.includes('s'))h+=dy;
   if(w<4){if(handle.includes('w'))x=orig.x+orig.w-4;w=4;}
   if(h<4){if(handle.includes('n'))y=orig.y+orig.h-4;h=4;}
   l.x=Math.round(x*10)/10;l.y=Math.round(y*10)/10;
   l.w=Math.round(w*10)/10;l.h=Math.round(h*10)/10;
  }
  const node=document.querySelector(`.element[data-id="${l.id}"]`);
  if(node){node.style.left=l.x+'%';node.style.top=l.y+'%';node.style.width=l.w+'%';node.style.height=l.h+'%';node.style.transform=`rotate(${l.rotation||0}deg)`;}
  overlay.style.left=l.x+'%';overlay.style.top=l.y+'%';overlay.style.width=l.w+'%';overlay.style.height=l.h+'%';overlay.style.transform=`rotate(${l.rotation||0}deg)`;
 };
 const up=()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',up);target.removeEventListener('pointercancel',up);if(moved){markChange({record:false});renderBoard();}};
 target.addEventListener('pointermove',move);target.addEventListener('pointerup',up);target.addEventListener('pointercancel',up);
}
function dragStart(e,layer,node){if(layer.locked||e.button!==0)return;selectLayer(layer.id);const board=$('#artboard').getBoundingClientRect();const sx=e.clientX,sy=e.clientY,ox=layer.x,oy=layer.y;let moved=false;node.setPointerCapture(e.pointerId);const move=ev=>{if(!moved&&Math.abs(ev.clientX-sx)+Math.abs(ev.clientY-sy)<4)return;if(!moved){history.push(snapshot());if(history.length>70)history.shift();future=[];moved=true;}const boundX=Math.max(0,100-layer.w),boundY=95;layer.x=Math.round(Math.max(0,Math.min(boundX,ox+(ev.clientX-sx)/board.width*100))*100)/100;layer.y=Math.round(Math.max(0,Math.min(boundY,oy+(ev.clientY-sy)/board.height*100))*100)/100;node.style.left=layer.x+'%';node.style.top=layer.y+'%';};const up=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',up);if(moved)markChange({record:false});};node.addEventListener('pointermove',move);node.addEventListener('pointerup',up);node.addEventListener('pointercancel',up);}
function selectLayer(id){selectedId=id;$$('.element').forEach(n=>n.classList.toggle('selected',n.dataset.id===id));renderLayers();renderProperties();renderSelection55();}
function selected(){return currentDesign?.layers.find(x=>x.id===selectedId)}
function renderProperties(){const l=selected(),isText=l?.type==='text',isShape=l?.type==='shape';$('#textSettings').classList.toggle('hidden',!isText);$('#shapeSettings').classList.toggle('hidden',!isShape);$('#objectSettings').classList.toggle('hidden',!l);if(!l)return;if(isText){$('#textValue').value=l.text||'';$('#fontSize').value=l.fontSize||34;$('#textColor').value=l.color||'#13233b';$('#fontFamily').value=l.font||'Arial';}if(isShape)$('#shapeColor').value=l.color||'#6d8cff';$('#widthRange').value=l.w||60;$('#rotationRange').value=l.rotation||0;$('#opacity').value=Math.round((l.opacity??1)*100);$('#shadow').value=l.shadow||'none';syncAdvanced55();}
function renderLayers(){const host=$('#layers');host.replaceChildren();for(const layer of [...(currentDesign?.layers||[])].reverse()){const c=el('div',{class:'layer'+(selectedId===layer.id?' active':'')});const title=layer.name||(layer.pinned?'📌 Fondo · ':'')+(layer.type==='text'?(layer.text||'Texto').slice(0,19):layer.type==='image'?(byId(assets,layer.assetId)?.name||'Imagen'):'Forma');const n=el('span',{class:'layername',text:(layer.type==='text'?'▤ ':layer.type==='image'?'▧ ':'◩ ')+title});n.onclick=()=>selectLayer(layer.id);const show=el('button',{title:'Mostrar/ocultar',text:layer.visible===false?'◌':'◉'});show.onclick=()=>changeLayer(layer.id,l=>l.visible=l.visible===false);const lock=el('button',{title:'Bloquear/desbloquear',text:layer.locked?'🔒':'♧'});lock.onclick=()=>changeLayer(layer.id,l=>l.locked=!l.locked);const del=el('button',{class:'danger',title:'Eliminar capa',text:'×'});del.onclick=()=>{history.push(snapshot());currentDesign.layers=currentDesign.layers.filter(x=>x.id!==layer.id);selectedId=currentDesign.layers.at(-1)?.id||null;markChange({record:false});renderBoard();};const handle=el('span',{text:'⠿',title:'Arrastra para ordenar',class:'layer-drag55'});c.draggable=true;c.ondragstart=e=>{e.dataTransfer.setData('text/plain',layer.id)};c.ondragover=e=>e.preventDefault();c.ondrop=e=>{e.preventDefault();const from=e.dataTransfer.getData('text/plain');reorderLayer55(from,layer.id)};
 c.prepend(handle);c.append(n,show,lock,del);host.append(c);}}
function changeLayer(id,fn){const l=byId(currentDesign.layers,id);if(!l)return;history.push(snapshot());future=[];fn(l);markChange({record:false});renderBoard();}
function modifySelected(fn){const l=selected();if(!l||l.locked)return;history.push(snapshot());future=[];fn(l);markChange({record:false});renderBoard();}
function addLayer(type,assetId){history.push(snapshot());future=[];const l={id:uid(),type,x:12,y:18,w:type==='text'?70:40,h:type==='text'?19:type==='image'?32:18,opacity:1,rotation:0,shadow:'none',visible:true,locked:false};if(type==='text')Object.assign(l,{text:'Nuevo texto',fontSize:36,color:'#13233b',font:'Arial'});if(type==='shape')Object.assign(l,{h:18,color:'#7390ff'});if(type==='image'){l.assetId=assetId;l.fit='contain';}currentDesign.layers.push(l);selectedId=l.id;markChange({record:false});renderBoard();}
function undo(){if(!history.length)return;future.push(snapshot());const s=JSON.parse(history.pop());Object.assign(currentDesign,s);selectedId=currentDesign.layers.at(-1)?.id||null;markChange({record:false});renderStudio();}
function redo(){if(!future.length)return;history.push(snapshot());const s=JSON.parse(future.pop());Object.assign(currentDesign,s);selectedId=currentDesign.layers.at(-1)?.id||null;markChange({record:false});renderStudio();}
function renderStudioAssets(){const target=$('#studioAssets');target.replaceChildren();const list=assets.filter(a=>a.project===currentProject.id&&previewableAsset(a));if(!list.length){target.append(el('p',{class:'helper',text:'Sube recursos en Biblioteca para colocarlos aquí.'}));return;}for(const a of list){const b=el('button',{title:'Agregar '+a.name});b.append(el('img',{src:imgUrl(a),alt:''}),el('small',{text:a.name}));b.onclick=()=>addLayer('image',a.id);target.append(b);}}
function bot(t){$('#chatlog').append(el('div',{class:'bubble',text:t}));$('#chatlog').scrollTop=100000;}
function user(t){$('#chatlog').append(el('div',{class:'bubble user',text:t}));$('#chatlog').scrollTop=100000;}
async function sendChat(){
 const input=$('#chatInput'),v=input.value.trim();if(!v||!currentProject)return;input.value='';user(v);
 chatHistory.push({role:'user',content:v});
 if(quickAIEdit55(v)){const reply='Apliqué los ajustes sobre la capa seleccionada. Puedes deshacerlos o editarlos manualmente.';bot(reply);chatHistory.push({role:'assistant',content:reply});return;}
 if(await askAIEdit55(v)){return;}
 if(!hasAI()){
   const wantsDesign=/\b(crea|crear|diseña|diseñar|post|publicaci[oó]n|anuncio|flyer|cartel|portada|promoci[oó]n)\b/i.test(v);
   if(wantsDesign)composeFromInstructionLocal(v);
   const notice=wantsDesign
    ?'Preparé una composición local EDITABLE usando los recursos disponibles. No es una fotografía generada por una red neuronal. Para conversar con IA instala Ollama; para fondos originales instala ComfyUI y un modelo compatible.'
    :'No hay un modelo de conversación instalado. Descarga uno con Ollama desde Configuración. Puedes crear diseños editables sin conexión.';
   bot(notice);chatHistory.push({role:'assistant',content:notice});
   await queueDb(()=>put(db,'settings',{id:'chat-'+currentProject.id,project:currentProject.id,messages:chatHistory.slice(-40)}));return;
 }
 const button=$('#sendChat');button.disabled=true;button.textContent='Pensando…';
 try{const r=await apiRequest('/api/ai/chat',{method:'POST',body:JSON.stringify({project_id:currentProject.id,personality:$('#aiPersonality').value,messages:chatHistory.slice(-24)})});bot(r.reply);chatHistory.push({role:'assistant',content:r.reply});await queueDb(()=>put(db,'settings',{id:'chat-'+currentProject.id,project:currentProject.id,messages:chatHistory.slice(-40)}));}
 catch(e){bot('No pude consultar la IA: '+e.message);}finally{button.disabled=false;button.textContent='Enviar';}
}
/* Biblioteca 5.2: categorías, carga segura con previsualización y carpetas completas. */
const DEFAULT_CATEGORIES = [
  {id:'General',name:'General',color:'#8193b2',keywords:[],builtin:true},
  {id:'Logotipo',name:'Logotipo',color:'#b78bff',keywords:[],builtin:true},
  {id:'Personaje',name:'Personaje',color:'#ffad70',keywords:[],builtin:true},
  {id:'Fondo',name:'Fondo',color:'#56c3d7',keywords:[],builtin:true},
  {id:'Elemento',name:'Elemento',color:'#6fbc8f',keywords:[],builtin:true},
  {id:'Tipografía',name:'Tipografía',color:'#f5cf76',keywords:[],builtin:true}
];
const selectedAssets = new Set();
let libraryProjectId = null, categoryEditId = null;
let stagedUpload = null, uploadRunning = false, cancelUploadRequested = false;
const getLibraryProject=()=>byId(projects,$('#libraryProject').value);
const projectCategories=p=>[...DEFAULT_CATEGORIES,...(Array.isArray(p?.customCategories)?p.customCategories:[])];
const catDef=(p,id)=>projectCategories(p).find(c=>c.id===id)||{id,name:id||'General',color:'#8291ac'};
const catName=(p,id)=>catDef(p,id).name;
const cleanWord=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function parseTags(text,limit=30){
 return [...new Set(String(text||'').split(/[,;\n]+/).map(t=>t.trim().replace(/\s+/g,' ').slice(0,40)).filter(Boolean))].slice(0,limit);
}
function category(filename,chosen='auto',project=null){
 // La selección explícita gana incluso cuando el archivo es una tipografía.
 if(chosen!=='auto' && chosen)return chosen;
 if(/\.(ttf|otf|woff2?)$/i.test(filename))return 'Tipografía';
 const name=cleanWord(filename);
 for(const custom of project?.customCategories||[]){
   if((custom.keywords||[]).some(word=>word.length>=2&&name.includes(cleanWord(word))))return custom.id;
 }
 if(/logo|logotipo|isotipo|brand/.test(name))return 'Logotipo';
 if(/personaje|character|mascota|avatar|penguin/.test(name))return 'Personaje';
 if(/fondo|background|wallpaper|texture|textura/.test(name))return 'Fondo';
 if(/icon|element|sticker|objeto/.test(name))return 'Elemento';
 return 'General';
}
function categoryOptions(node,project,{includeAll=false,includeAuto=false,value,includeLabel=true}={}){
 node.replaceChildren();
 if(includeAll)node.append(el('option',{value:'all',text:'Todas las categorías'}));
 if(includeAuto)node.append(el('option',{value:'auto',text:'✦ Automáticamente (nombre y reglas)'}));
 for(const c of projectCategories(project))node.append(el('option',{value:c.id,text:c.name}));
 if(value&&[...node.options].some(x=>x.value===value))node.value=value;
 else node.value=includeAll?'all':includeAuto?'auto':'General';
 return node;
}
function getVisibleLibraryAssets(){
 const project=getLibraryProject(),pid=project?.id;
 const q=cleanWord($('#assetSearch').value);
 const filter=$('#assetFilter').value, folder=$('#assetFolderFilter').value;
 return assets.filter(a=>a.project===pid && (filter==='all'||a.kind===filter)
   &&(folder==='all'||(a.folderPath||'')===folder)
   &&(!q||cleanWord([a.name,a.relativePath||'',a.folderPath||'',catName(project,a.kind),...(a.tags||[])].join(' ')).includes(q)));
}
function categorySelector(project,current,onChange){
 const select=el('select',{title:'Cambiar categoría','aria-label':'Categoría del recurso'});
 categoryOptions(select,project,{value:current});
 select.value=current;
 select.onchange=()=>onChange(select.value,select);
 return select;
}
async function saveAssetChange(asset,changes){
 const updated={...asset,...changes};
 await queueDb(()=>put(db,'assets',updated));
 Object.assign(asset,updated);
 renderLibrary();
}
async function inspect(file){if(!file.type.startsWith('image/')||file.type==='image/svg+xml')return{width:0,height:0,ratio:0,palette:[]};let url=URL.createObjectURL(file);try{const im=new Image();im.src=url;await im.decode();const can=document.createElement('canvas');can.width=32;can.height=32;const ctx=can.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,32,32);const dat=ctx.getImageData(0,0,32,32).data;const count={};for(let i=0;i<dat.length;i+=16){if(dat[i+3]<120)continue;const c=[dat[i],dat[i+1],dat[i+2]].map(v=>Math.min(255,Math.round(v/32)*32).toString(16).padStart(2,'0')).join('');count[c]=(count[c]||0)+1;}return{width:im.naturalWidth,height:im.naturalHeight,ratio:im.naturalWidth/im.naturalHeight,palette:Object.entries(count).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>'#'+k)};}catch{return{width:0,height:0,ratio:0,palette:[]}}finally{URL.revokeObjectURL(url)}}

// La selección previa nunca modifica archivos ni datos hasta confirmar la subida.
const ALLOWED_ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|ttf|otf|woff2?|pdf|psd|mp4|mov|webm|mp3|wav)$/i;
function cleanRelativePath(file){
 const raw=String(file.webkitRelativePath||'').replace(/\\/g,'/');
 if(!raw)return {relativePath:'',folderPath:''};
 const segments=raw.split('/').filter(x=>x&&x!=='.'&&x!=='..').map(x=>x.slice(0,130));
 if(segments.length<2)return {relativePath:'',folderPath:''};
 const relativePath=segments.join('/').slice(0,650);
 return {relativePath,folderPath:segments.slice(0,-1).join('/').slice(0,520)};
}
function assetIsSupported(file){return ALLOWED_ASSET_EXT.test(file.name)}
function fileIdentity(projectId,name,size,folder){return JSON.stringify([projectId,name,size,folder||'']);}
function uploadResult(message,fail=false){const e=$('#uploadResult');e.textContent=message;e.classList.toggle('upload-error',fail);}
function discardStagedUpload(){$('#uploadWorkflow').classList.add('hidden');stagedUpload=null;$('#uploadPreview').classList.add('hidden');$('#fileInput').value='';$('#folderInput').value='';}
function stageFiles(fileList,source='files'){
 if(uploadRunning){toast('Termina la carga actual antes de seleccionar otros archivos.');return;}
 const project=getLibraryProject();if(!project){toast('Crea un proyecto antes de subir archivos.');return;}
 const categoryChoice=$('#assetType').value;
 const tags=parseTags($('#uploadTags').value,20);
 const skipDuplicates=$('#uploadSkipDuplicates').checked;
 const existingIds=new Set(assets.filter(a=>a.project===project.id)
  .map(a=>fileIdentity(project.id,a.name,a.size,a.folderPath)));
 const seen=new Set(),entries=[];
 for(const file of fileList){
   const {relativePath,folderPath}=cleanRelativePath(file);
   let reason='';
   if(!assetIsSupported(file))reason='Formato no admitido';
   else if(!file.size)reason='Archivo vacío';
   else if(file.size>20*1024*1024)reason='Supera 20 MB';
   const identity=fileIdentity(project.id,file.name,file.size,folderPath);
   if(!reason&&skipDuplicates&&(existingIds.has(identity)||seen.has(identity)))reason='Duplicado';
   if(!reason)seen.add(identity);
   entries.push({file,relativePath,folderPath,category:category(file.name,categoryChoice,project),reason});
 }
 const accepted=entries.filter(x=>!x.reason),excluded=entries.length-accepted.length;
 if(!entries.length){toast('No se seleccionaron archivos.');return;}
 stagedUpload={projectId:project.id,projectName:project.name,categoryChoice,tags,entries,source};
 const categoryText=categoryChoice==='auto'?'automática por nombre y reglas':catName(project,categoryChoice);
 const size=accepted.reduce((total,x)=>total+x.file.size,0);
 $('#uploadPreviewSummary').textContent=`Proyecto: ${project.name} · Categoría: ${categoryText} · ${accepted.length} listo(s) · ${excluded} omitido(s) · ${(size/1024/1024).toFixed(1)} MB en total. ${source==='folder'?'Se conservarán las rutas de la carpeta.':''}`;
 const host=$('#uploadPreviewFiles');host.replaceChildren();
 for(const entry of entries.slice(0,50)){
   const row=el('div',{class:'upload-file-item'+(entry.reason?' is-skipped':'')});
   row.append(el('span',{text:entry.relativePath||entry.file.name}),el('span',{text:entry.reason||catName(project,entry.category)}));host.append(row);
 }
 if(entries.length>50)host.append(el('div',{class:'helper',text:`… y ${entries.length-50} archivos adicionales` }));
 $('#confirmUpload').disabled=!accepted.length;
 $('#uploadWorkflow').classList.remove('hidden');$('#uploadPreview').classList.remove('hidden');
 uploadResult('Verifica la categoría y los nombres. Nada se sube hasta pulsar Confirmar y subir.');
 $('#uploadPreview').scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function uploadStagedFiles(){
 if(!stagedUpload||uploadRunning)return;
 const staged=stagedUpload;
 const accepted=staged.entries.filter(x=>!x.reason);
 if(!accepted.length)return;
 const project=byId(projects,staged.projectId);
 if(!project){toast('El proyecto de destino ya no existe.');discardStagedUpload();return;}
 uploadRunning=true;cancelUploadRequested=false;
 $('#uploadPreview').classList.add('hidden');
 $('#uploadProgressWrap').classList.remove('hidden');
 const buttons=['uploadAssets','uploadFolders','uploadNewCategory','confirmUpload'];
 for(const id of buttons)$('#'+id).disabled=true;
 $('#libraryProject').disabled=true;
 const bar=$('#uploadProgress'),label=$('#uploadProgressLabel');bar.max=accepted.length;bar.value=0;
 let ok=0,failed=[];
 for(let i=0;i<accepted.length;i++){
   if(cancelUploadRequested)break;
   const item=accepted[i],file=item.file;
   label.textContent=`Subiendo ${i+1} de ${accepted.length}: ${file.name}`;
   const meta=await inspect(file);
   const tags=[...staged.tags];
   if(meta.ratio>2)tags.push('horizontal');else if(meta.ratio&&meta.ratio<.7)tags.push('vertical');else if(meta.ratio>.9&&meta.ratio<1.1)tags.push('cuadrado');
   if(meta.width>=1500||meta.height>=1500)tags.push('alta resolución');
   const record={id:uid(),project:staged.projectId,name:file.name,type:guessMime(file.name),size:file.size,
     blob:file,meta,kind:item.category,suggestedKind:item.category,reviewStatus:'pending',
     tags:parseTags(tags.join(',')),logo:false,relativePath:item.relativePath,folderPath:item.folderPath,created:Date.now()};
   try{
     await queueDb(()=>put(db,'assets',record));
     delete record.blob;assets.push(record);ok++;
   }catch(e){failed.push(`${file.name}: ${e.message}`);}
   bar.value=i+1;
 }
 uploadRunning=false;
 for(const id of buttons)$('#'+id).disabled=false;
 $('#libraryProject').disabled=false;
 $('#uploadProgressWrap').classList.add('hidden');
 const omitted=staged.entries.filter(x=>x.reason).length;
 const message=`${ok} archivo(s) guardado(s) en ${staged.projectName}. ${omitted} omitidos en la selección. ${failed.length} errores de subida.${cancelUploadRequested?' Carga detenida.':''}`;
 uploadResult(message+(failed.length?' '+failed.slice(0,3).join(' · '):''),!!failed.length);
 discardStagedUpload();
 if(getLibraryProject()?.id===staged.projectId){$('#assetSearch').value='';$('#assetFilter').value='all';$('#assetFolderFilter').value='all';}
 renderLibrary();toast(message);
}
function renderCategoryChips(project,list){
 const host=$('#categoryChips');host.replaceChildren();
 const filter=$('#assetFilter').value;
 const categories=projectCategories(project);
 const pairs=[{id:'all',name:'Todos',color:'#94a5c6'},...categories];
 for(const c of pairs){
   const count=c.id==='all'?list.length:list.filter(a=>a.kind===c.id).length;
   const btn=el('button',{class:'category-chip'+(filter===c.id?' active':''),type:'button'});
   const dot=el('span',{class:'cat-dot'});dot.style.backgroundColor=c.color;
   btn.append(dot,el('span',{text:c.name}),el('span',{class:'count',text:String(count)}));
   btn.onclick=()=>{$('#assetFilter').value=c.id;renderLibrary();};host.append(btn);
 }
}
function renderCategoryManager(){
 const project=getLibraryProject(),host=$('#categoryGrid');host.replaceChildren();
 if(!project)return;
 const allAssets=assets.filter(a=>a.project===project.id);
 for(const c of projectCategories(project)){
   const item=el('div',{class:'category-entry'}),title=el('div',{class:'entry-name'}),dot=el('span',{class:'cat-dot'});
   dot.style.backgroundColor=c.color;
   title.append(dot,el('span',{text:c.name}),el('span',{class:'pill',text:String(allAssets.filter(a=>a.kind===c.id).length)}));item.append(title);
   item.append(el('p',{class:'entry-keywords',text:c.builtin?'Categoría de sistema':(c.keywords?.length?'Auto: '+c.keywords.join(', '):'Sin palabras clave')}));
   const actions=el('div',{class:'entry-actions'});
   if(!c.builtin){
     const editButton=el('button',{type:'button',text:'Editar'}),deleteButton=el('button',{type:'button',class:'danger',text:'Eliminar'});
     editButton.onclick=()=>{
       categoryEditId=c.id;$('#categoryName').value=c.name;$('#categoryColor').value=c.color||'#7a94ff';
       $('#categoryKeywords').value=(c.keywords||[]).join(', ');
       $('#saveCategory').textContent='Guardar cambios';$('#cancelCategory').classList.remove('hidden');
       $('#categoryName').focus();
     };
     deleteButton.onclick=async()=>{
       const affected=allAssets.filter(a=>a.kind===c.id);
       if(!await askConfirm('Eliminar categoría',`${affected.length} archivo(s) pasarán a General. Los archivos no se borrarán.`))return;
       const newProject={...project,customCategories:(project.customCategories||[]).filter(x=>x.id!==c.id)};
       const ops=[{store:'projects',value:newProject},...affected.map(a=>({store:'assets',value:{...a,kind:'General',reviewStatus:'pending',suggestedKind:'General'}}))];
       try{await queueDb(()=>batch(db,ops));Object.assign(project,newProject);for(const a of affected){a.kind='General';a.reviewStatus='pending';a.suggestedKind='General';}selectedAssets.clear();if($('#assetFilter').value===c.id)$('#assetFilter').value='all';resetCategoryForm();renderLibrary();toast('Categoría eliminada. Los archivos se conservaron en General.');}
       catch(e){toast('No se pudo eliminar: '+e.message)}
     };
     actions.append(editButton,deleteButton);
   }else actions.append(el('span',{class:'smallmuted',text:'Categoría incluida'}));
   item.append(actions);host.append(item);
 }
}
function resetCategoryForm(){
 categoryEditId=null;$('#categoryForm').reset();$('#categoryColor').value='#7a94ff';
 $('#saveCategory').textContent='＋ Crear categoría';$('#cancelCategory').classList.add('hidden');
}
async function submitCategory(){
 const project=getLibraryProject();if(!project)return;
 const name=$('#categoryName').value.trim().replace(/\s+/g,' '),color=$('#categoryColor').value;
 const keywords=parseTags($('#categoryKeywords').value,20).map(cleanWord).filter(w=>w.length>=2);
 if(name.length<2||name.length>45){toast('Escribe un nombre de 2 a 45 caracteres.');return;}
 const existing=projectCategories(project).find(c=>cleanWord(c.name)===cleanWord(name)&&c.id!==categoryEditId);
 if(existing){toast('Ya existe una categoría con ese nombre.');return;}
 if((project.customCategories||[]).length>=60&&!categoryEditId){toast('Máximo 60 categorías personalizadas por proyecto.');return;}
 const record={id:categoryEditId||'custom_'+uid().replace(/[^\w-]/g,''),name,color,keywords};
 const customs=(project.customCategories||[]).filter(c=>c.id!==record.id);
 customs.push(record);
 const updated={...project,customCategories:customs};
 try{await queueDb(()=>put(db,'projects',updated));Object.assign(project,updated);resetCategoryForm();renderLibrary();toast(`Categoría «${name}» guardada.`)}
 catch(e){toast('No se pudo guardar categoría: '+e.message)}
}
function renderLibraryCore(){
 const projectSelector=$('#libraryProject'),prev=projectSelector.value||currentProject?.id;
 projectSelector.replaceChildren();for(const p of projects)projectSelector.append(el('option',{value:p.id,text:p.name}));
 if(projects.some(p=>p.id===prev))projectSelector.value=prev;
 else if(currentProject&&projects.some(p=>p.id===currentProject.id))projectSelector.value=currentProject.id;
 const project=getLibraryProject(),pid=project?.id;
 if(libraryProjectId!==pid){selectedAssets.clear();libraryProjectId=pid;resetCategoryForm();}
 const oldFilter=$('#assetFilter').value,oldType=$('#assetType').value;
 categoryOptions($('#assetFilter'),project,{includeAll:true,value:oldFilter});
 categoryOptions($('#assetType'),project,{includeAuto:true,value:oldType});
 categoryOptions($('#bulkCategory'),project,{value:$('#bulkCategory').value});
 const folderSelector=$('#assetFolderFilter'),oldFolder=folderSelector.value;
 folderSelector.replaceChildren(el('option',{value:'all',text:'Todas las carpetas'}),el('option',{value:'',text:'Archivos sueltos'}));
 for(const path of [...new Set(assets.filter(a=>a.project===pid&&a.folderPath).map(a=>a.folderPath))].sort((a,b)=>a.localeCompare(b,'es')))
   folderSelector.append(el('option',{value:path,text:'📁 '+path}));
 folderSelector.value=[...folderSelector.options].some(o=>o.value===oldFolder)?oldFolder:'all';
 const allAssets=assets.filter(a=>a.project===pid),pending=allAssets.filter(a=>a.reviewStatus==='pending');
 for(const id of [...selectedAssets])if(!allAssets.some(a=>a.id===id))selectedAssets.delete(id);
 $('#pendingCount').textContent=pending.length+' pendientes';
 $('#assetCount').textContent='('+getVisibleLibraryAssets().length+')';
 renderCategoryChips(project,allAssets);
 renderCategoryManager();
 const summary=$('#memorySummary');summary.replaceChildren();
 const top=el('div',{class:'summarytop'}),left=el('div');
 left.append(el('span',{class:'pill',text:'ORGANIZACIÓN POR PROYECTO · 5.2'}),el('h2',{text:project?.name||'Sin proyecto'}),
   el('p',{class:'assetmeta',text:`${allAssets.length} archivos · ${project?.customCategories?.length||0} categorías propias · ${pending.length} por revisar`}));
 top.append(left);
 const logo=allAssets.find(a=>a.logo);
 if(logo&&previewableAsset(logo))top.append(el('img',{src:imgUrl(logo),alt:'Logotipo oficial'}));
 else top.append(el('span',{class:'pill',text:'Logo sin confirmar'}));
 summary.append(top);
 const colors=[...new Set(allAssets.flatMap(a=>a.meta?.palette||[]))].slice(0,8),palette=el('div',{class:'palette'});
 for(const c of colors){const sw=el('span',{class:'swatch',title:c});sw.style.background=c;palette.append(sw)}
 const shortList=el('div',{class:'summary-categories'});
 for(const c of projectCategories(project).filter(c=>allAssets.some(a=>a.kind===c.id)).slice(0,8)){
   shortList.append(el('span',{class:'pill',text:`${c.name}: ${allAssets.filter(a=>a.kind===c.id).length}`}));
 }
 summary.append(shortList,el('p',{class:'helper no-padding',text:'Puedes cambiar la categoría de cada archivo, seleccionar varios o crear categorías nuevas con reglas de nombre.'}),palette);
 const queue=$('#reviewQueue');queue.replaceChildren();
 for(const a of pending.slice(0,12)){
   const card=el('div',{class:'card review-card'});
   if(previewableAsset(a))card.append(el('img',{class:'thumb',src:imgUrl(a),alt:a.name}));
   else card.append(el('div',{class:'empty',text:'ARCHIVO DE FUENTE'}));
   card.append(el('h3',{class:'name',text:a.name}),el('p',{class:'assetmeta',text:'Sugerencia: '+catName(project,a.kind)}));
   const row=el('div',{class:'review-row'}),select=categorySelector(project,a.kind,()=>{}),approve=el('button',{class:'primary',text:'✓ Aprobar'});
   approve.onclick=async()=>{if(a.logo&&select.value!=='Logotipo'){toast('El logotipo oficial debe permanecer en la categoría Logotipo.');return;}
     try{await saveAssetChange(a,{kind:select.value,reviewStatus:'approved'});}catch(e){toast(e.message)}};
   row.append(select,approve);card.append(row);queue.append(card);
 }
 if(pending.length>12)queue.append(el('div',{class:'empty',text:`Hay ${pending.length-12} más por revisar. Puedes seleccionarlos y marcar varios como revisados desde la barra de acciones.`}));
 if(!pending.length)queue.append(el('div',{class:'empty',text:'Todo revisado. Los archivos nuevos aparecerán aquí.'}));
 const visible=getVisibleLibraryAssets(),gallery=$('#assetList');gallery.replaceChildren();
 for(const a of visible){
   const card=el('article',{class:'card asset-card'+(selectedAssets.has(a.id)?' is-selected':'')});
   const visual=el('div',{class:'asset-visual'});
   if(previewableAsset(a))visual.append(el('img',{class:'thumb',src:imgUrl(a),alt:a.name}));
   else visual.append(el('span',{class:'pill',text:'TIPOGRAFÍA'}));
   card.append(visual);
   const head=el('div',{class:'asset-card-head'}),checkLabel=el('label',{class:'file-select',title:'Seleccionar '+a.name});
   const checkbox=el('input',{type:'checkbox','aria-label':'Seleccionar '+a.name});checkbox.checked=selectedAssets.has(a.id);
   checkbox.onchange=()=>{if(checkbox.checked)selectedAssets.add(a.id);else selectedAssets.delete(a.id);renderLibrary();};
   checkLabel.append(checkbox);head.append(checkLabel,el('h3',{class:'asset-name',text:a.name}));card.append(head);
   const dims=a.meta?.width?`${a.meta.width} × ${a.meta.height} px`:(a.type||guessMime(a.name));
   const info=el('p',{class:'assetmeta',text:`${dims} · ${Math.round((a.size||0)/1024)} KB · ${a.reviewStatus==='approved'?'✓ Revisado':'• Por revisar'}${a.logo?' · ★ Logo oficial':''}`});card.append(info);
   if(a.folderPath)card.append(el('p',{class:'asset-folder-meta',text:'📁 '+a.folderPath}));
   const categoryRow=el('div',{class:'asset-category-control'}),dot=el('span',{class:'cat-dot'});dot.style.background=catDef(project,a.kind).color;
   const select=categorySelector(project,a.kind,async value=>{
     if(a.logo&&value!=='Logotipo'){toast('Este es el logotipo oficial. Desígnale otro logotipo primero.');select.value=a.kind;return;}
     select.disabled=true;try{await saveAssetChange(a,{kind:value,suggestedKind:value,reviewStatus:'approved'});}catch(e){toast('No se pudo guardar: '+e.message);select.value=a.kind;}finally{select.disabled=false;}
   });categoryRow.append(dot,select);card.append(categoryRow);
   const tags=el('div',{class:'asset-tags'});
   for(const tag of (a.tags||[]).slice(0,5))tags.append(el('span',{class:'tag-pill',text:tag}));
   if((a.tags||[]).length>5)tags.append(el('span',{class:'tag-pill',text:'+'+(a.tags.length-5)}));
   const editTags=el('button',{class:'tag-edit secondary',text:'✎ Etiquetas'});
   editTags.onclick=async()=>{const text=await askText('Editar etiquetas',(a.tags||[]).join(', '),'Etiquetas, separadas por comas');if(text===null)return;
     try{await saveAssetChange(a,{tags:parseTags(text)});toast('Etiquetas guardadas.');}catch(e){toast(e.message)}};
   tags.append(editTags);card.append(tags);
   const actions=el('div',{class:'asset-card-footer'}),logoBtn=el('button',{class:'secondary',text:a.logo?'★ Logo oficial':'☆ Marcar logo'}),del=el('button',{class:'danger',text:'Eliminar'});
   logoBtn.onclick=async()=>{
     if(!await askConfirm('Confirmar logotipo oficial','Reemplazará al logotipo oficial anterior. La imagen original se conserva.'))return;
     const changed=allAssets.filter(x=>x.logo).map(x=>({...x,logo:false})),updated={...a,logo:true,kind:'Logotipo',reviewStatus:'approved'},pNew={...project,logo:a.id};
     try{await queueDb(()=>batch(db,[...changed.map(value=>({store:'assets',value})),{store:'assets',value:updated},{store:'projects',value:pNew}]));
       for(const x of allAssets.filter(x=>x.logo))x.logo=false;Object.assign(a,updated);Object.assign(project,pNew);renderLibrary();}
     catch(e){toast('No se pudo guardar el logo: '+e.message)}
   };
   del.onclick=async()=>{
     if(!await askConfirm('Eliminar recurso','Los diseños que lo utilicen podrían quedarse sin imagen.',true))return;
     const ops=[{store:'assets',kind:'delete',id:a.id}];if(project.logo===a.id)ops.push({store:'projects',value:{...project,logo:null}});
     try{await queueDb(()=>batch(db,ops));if(project.logo===a.id)project.logo=null;releaseUrl(a.id);assets=assets.filter(x=>x.id!==a.id);selectedAssets.delete(a.id);renderLibrary();}
     catch(e){toast('Error al eliminar: '+e.message)}
   };
   actions.append(logoBtn,del);
   if(!['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'].includes(a.type||guessMime(a.name))){
     const download=el('a',{class:'download-asset',href:imgUrl(a),download:a.name,text:'↓ Descargar archivo'});actions.append(download);
   }
   if(hasAI()&&previewableAsset(a)&&a.type!=='image/svg+xml'){
     const analyze=el('button',{class:'secondary',text:'✧ Analizar IA'});analyze.onclick=()=>analyzeResource(a,analyze);actions.append(analyze);
   }
   card.append(actions);gallery.append(card);
 }
 if(!visible.length)gallery.append(el('div',{class:'empty',text:allAssets.length?'No hay resultados para estos filtros.':'Aún no tienes archivos. Sube imágenes o crea tus categorías.'}));
 updateSelectionControls(visible,allAssets);
}
function updateSelectionControls(visible,allAssets){
 const count=selectedAssets.size,total=visible.length;
 $('#selectionCount').textContent=count===1?'1 archivo seleccionado':`${count} archivos seleccionados`;
 const allVisible=visible.length>0&&visible.every(a=>selectedAssets.has(a.id)),someVisible=visible.some(a=>selectedAssets.has(a.id));
 const check=$('#selectVisible');check.checked=allVisible;check.indeterminate=!allVisible&&someVisible;
 for(const id of ['bulkApply','bulkTagsApply','bulkAuto','bulkApprove','clearSelection'])$('#'+id).disabled=!count;
}
async function bulkUpdate(transform,message){
 const project=getLibraryProject(),selected=assets.filter(a=>a.project===project?.id&&selectedAssets.has(a.id));
 if(!selected.length)return;
 const updated=selected.map(a=>({old:a,newRecord:transform(a)})).filter(x=>x.newRecord);
 if(!updated.length){toast('No hay archivos que puedan modificarse.');return;}
 const operations=updated.map(({newRecord})=>({store:'assets',value:newRecord}));
 for(const b of ['bulkApply','bulkTagsApply','bulkAuto','bulkApprove'])$('#'+b).disabled=true;
 try{await queueDb(()=>batch(db,operations));for(const pair of updated)Object.assign(pair.old,pair.newRecord);
   selectedAssets.clear();renderLibrary();toast(`${updated.length} archivo(s): ${message}`);
 }catch(e){toast('No se pudieron guardar todos los cambios: '+e.message);renderLibrary();}
}
function renderLibrary(){renderLibraryCore();refreshLibrary55();}
function setupLibrary51(){
 $('#manageCategories').onclick=()=>{$('#categoryManager').classList.toggle('hidden');if(!$('#categoryManager').classList.contains('hidden'))$('#categoryName').focus();};
 $('#closeCategories').onclick=()=>{$('#categoryManager').classList.add('hidden');resetCategoryForm();};
 $('#categoryForm').onsubmit=e=>{e.preventDefault();submitCategory();};
 $('#cancelCategory').onclick=resetCategoryForm;
 $('#selectVisible').onchange=e=>{const visible=getVisibleLibraryAssets();if(e.target.checked)visible.forEach(a=>selectedAssets.add(a.id));else visible.forEach(a=>selectedAssets.delete(a.id));renderLibrary();};
 $('#clearSelection').onclick=()=>{selectedAssets.clear();renderLibrary();};
 $('#bulkApply').onclick=()=>{const next=$('#bulkCategory').value;
   const skipped=assets.filter(a=>selectedAssets.has(a.id)&&a.logo&&next!=='Logotipo').length;
   if(skipped)toast(`${skipped} logotipo(s) oficiales permanecerán como Logotipo.`);
   bulkUpdate(a=>a.logo&&next!=='Logotipo'?null:{...a,kind:next,suggestedKind:next,reviewStatus:'approved'},'categoría actualizada');
 };
 $('#bulkTagsApply').onclick=()=>{const tags=parseTags($('#bulkTags').value,20);if(!tags.length){toast('Escribe al menos una etiqueta separada por comas.');return;}
   bulkUpdate(a=>({...a,tags:parseTags([...(a.tags||[]),...tags].join(','))}),'etiquetas agregadas');$('#bulkTags').value='';
 };
 $('#bulkApprove').onclick=()=>bulkUpdate(a=>({...a,reviewStatus:'approved'}),'revisión aprobada');
 $('#bulkAuto').onclick=()=>{const p=getLibraryProject();const skipped=assets.filter(a=>a.logo&&selectedAssets.has(a.id)).length;
   if(skipped)toast('Los logos oficiales no se reclasifican automáticamente.');
   bulkUpdate(a=>a.logo?null:{...a,kind:category(a.name,'auto',p),suggestedKind:category(a.name,'auto',p),reviewStatus:'pending'},'clasificación sugerida según nombres y reglas');
 };
}

function renderDesignPreview(design){
 const preview=el('div',{class:'design-preview',title:'Abrir '+design.name});
 preview.style.aspectRatio=design.ratio||'1/1';preview.style.background=design.bg||'#dceeff';
 for(const layer of (design.layers||[])){
   if(layer.visible===false)continue;
   const node=el('div',{class:'preview-layer '+(layer.type||'')});
   node.style.left=(layer.x||0)+'%';node.style.top=(layer.y||0)+'%';node.style.width=(layer.w||60)+'%';
   node.style.opacity=layer.opacity??1;node.style.transform=`rotate(${layer.rotation||0}deg)`;
   if(layer.type==='text'){
     node.textContent=layer.text||'';node.style.fontFamily=layer.font||'Arial';
     node.style.color=layer.color||'#111c35';node.style.fontSize=((layer.fontSize||34)/470*245)+'px';
     node.style.fontWeight='900';node.style.lineHeight='1.05';node.style.whiteSpace='pre-wrap';
   }else if(layer.type==='shape'){
     node.style.background=layer.color||'#748cff';node.style.height=(layer.h||18)+'%';node.style.borderRadius='4px';
   }else if(layer.type==='image'){
     const asset=byId(assets,layer.assetId);
     if(asset)node.append(el('img',{src:imgUrl(asset),alt:''}));
   }
   preview.append(node);
 }
 preview.onclick=()=>openProject(design.project,design.id);
 return preview;
}
function renderDesigns(){const filter=$('#designProjectFilter'),old=filter.value||currentProject?.id||'all';filter.replaceChildren(el('option',{value:'all',text:'Todos los proyectos'}));for(const p of projects)filter.append(el('option',{value:p.id,text:p.name}));filter.value=old==='all'||byId(projects,old)?old:'all';const grid=$('#designGrid');grid.replaceChildren();for(const d of [...designs].filter(d=>filter.value==='all'||d.project===filter.value).sort((a,b)=>b.updated-a.updated)){const p=byId(projects,d.project);const c=el('div',{class:'card projectcard'});c.innerHTML=`<div><span class="pill">${esc(p?.name||'Proyecto eliminado')}</span><h3>${esc(d.name)}</h3><p>${d.layers?.length||0} capas · ${esc(d.ratio)} · Última edición ${date(d.updated)}</p></div><div class="cardactions"><button class="primary open">Abrir</button><button class="rename">Renombrar</button><button class="duplicate">Duplicar</button><button class="danger del">Eliminar</button></div>`;c.prepend(renderDesignPreview(d));const more=el('button',{text:'Información',class:'secondary'});more.onclick=()=>showInfo('Información del diseño',`Diseño: ${d.name}\nProyecto: ${p?.name||'—'}\nFormato: ${d.ratio}\nCapas: ${d.layers?.length||0}\nCreado: ${date(d.created)}\nActualizado: ${date(d.updated)}\nID: ${d.id}`);c.querySelector('.cardactions').append(more);c.querySelector('.open').onclick=()=>openProject(d.project,d.id);c.querySelector('.rename').onclick=async()=>{const n=await askText('Renombrar diseño',d.name,'Nombre del diseño');if(!n?.trim())return;d.name=n.trim();d.updated=Date.now();await queueDb(()=>put(db,'designs',d));renderDesigns()};c.querySelector('.duplicate').onclick=async()=>{const clone=structuredClone(d);clone.id=uid();clone.name=d.name+' (copia)';clone.created=clone.updated=Date.now();clone.layers=clone.layers.map(l=>({...l,id:uid()}));await queueDb(()=>put(db,'designs',clone));designs.push(clone);renderDesigns()};c.querySelector('.del').onclick=async()=>{if(!await askConfirm('Eliminar diseño','El diseño se eliminará junto con sus capas. Exporta un respaldo si deseas conservarlo.',true))return;await queueDb(()=>remove(db,'designs',d.id));designs=designs.filter(x=>x.id!==d.id);if(currentDesign?.id===d.id){currentDesign=defaultDesign(d.project);dirty=false;}renderDesigns()};condenseCardActions56(c);grid.append(c);}if(!grid.children.length)grid.append(el('div',{class:'empty',text:'Todavía no tienes diseños guardados en esta selección.'}));}
function updateProperty(id,fn){$(id).addEventListener('change',()=>modifySelected(fn));}
function drawImage(ctx,im,x,y,w,h){ctx.drawImage(im,x,y,w,h);}
async function exportPng(){return exportImage('image/png');}
async function exportImage(format='image/png',options={}){
 await saveCurrent();await document.fonts?.ready;
 const ratio=currentDesign.ratio.split('/').map(Number);let w=1080,h=Math.round(w*ratio[1]/ratio[0]);if(ratio[0]===16){w=1920;h=1080;}if(ratio[0]===9){w=1080;h=1920;}
 const scale=Math.max(1,Math.min(4,+options.scale||1));w*=scale;h*=scale;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const c=canvas.getContext('2d');if(!(options.transparent && ['image/png','image/webp'].includes(format))){c.fillStyle=currentDesign.bg;c.fillRect(0,0,w,h);}
 for(const l of currentDesign.layers){if(l.visible===false)continue;c.save();c.globalAlpha=l.opacity??1;
  const x=l.x/100*w,y=l.y/100*h,width=l.w/100*w,height=(l.h||(l.type==='text'?18:Math.max(12,l.w*.75)))/100*h;
  c.translate(x+width/2,y+height/2);c.rotate((l.rotation||0)*Math.PI/180);c.translate(-width/2,-height/2);
  if(l.shadow&&l.shadow!=='none'){c.shadowColor='#0008';c.shadowBlur=l.shadow==='strong'?24:10;c.shadowOffsetY=l.shadow==='strong'?12:5;}
  if(l.type==='shape'){
   c.fillStyle=l.color||'#7390ff';c.beginPath();c.roundRect(0,0,width,height,Math.min(16,w/60));c.fill();
  }else if(l.type==='text'){
   const fontsize=(l.fontSize||34)/470*w;
   c.font=`${l.italic?'italic ':''}${l.bold===false?'400':'900'} ${fontsize}px ${l.font||'Arial'}`;
   c.fillStyle=l.color||'#13233b';c.textBaseline='top';c.textAlign=l.align||'left';
   const lines=[];for(const para of (l.text||'').split('\n')){let line='';for(const word of para.split(' ')){const test=line?line+' '+word:word;if(c.measureText(test).width>width&&line){lines.push(line);line=word;}else line=test;}lines.push(line);}
   const tx=(l.align==='center'?width/2:l.align==='right'?width:0);
   if(l.effect==='outline'){c.strokeStyle=l.effectColor||'#111';c.lineWidth=Math.max(2,w/700);lines.forEach((line,i)=>c.strokeText(line,tx,i*fontsize*1.08,width));}
   if(['glow','neon','echo','shadow'].includes(l.effect)){c.shadowColor=l.effectColor||'#bd77e8';c.shadowBlur=fontsize*.3;}
   lines.forEach((line,i)=>{const yy=i*fontsize*1.08;c.fillText(line,tx,yy,width);
    if(l.underline||l.strike){const tw=Math.min(width,c.measureText(line).width);const left=l.align==='center'?(width-tw)/2:l.align==='right'?width-tw:0;c.fillRect(left,yy+(l.strike?fontsize*.54:fontsize*.97),tw,Math.max(1,fontsize/26));}});
  }else if(l.type==='image'){
   const asset=byId(assets,l.assetId);if(asset){try{
    const im=new Image();im.src=imgUrl(asset);await im.decode();
    c.beginPath();c.roundRect(0,0,width,height,Math.max(0,l.radius||0)/470*w);c.clip();
    c.save();c.translate(width/2,height/2);c.scale(l.flipH?-1:1,l.flipV?-1:1);c.translate(-width/2,-height/2);
    c.filter=l.imgFilter||'none';
    const fit=l.fit||'contain',scale=fit==='cover'?Math.max(width/im.width,height/im.height):fit==='contain'?Math.min(width/im.width,height/im.height):1;
    const dw=fit==='fill'?width:im.width*scale,dh=fit==='fill'?height:im.height*scale;
    const zoom=(l.zoom||100)/100;const ww=dw*zoom,hh=dh*zoom;
    const ox=(width-ww)*(l.cropX??50)/100,oy=(height-hh)*(l.cropY??50)/100;
    c.drawImage(im,ox,oy,ww,hh);c.restore();
    if(l.strokeWidth){c.strokeStyle=l.strokeColor||'#ffffff';c.lineWidth=l.strokeWidth/470*w;c.strokeRect(0,0,width,height);}
   }catch(e){console.warn('No se exportó una imagen:',e);}}}
  c.restore();
 }
 const today=new Date(currentDesign.created||Date.now()).toLocaleDateString('en-CA');
 const base=(options.name||`${today} - ${currentDesign.name||'Diseño'}`).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim().slice(0,140)||'Diseño';
 const canvasBlob=(type,quality)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No se pudo crear el archivo.')),type,quality));
 const quality=Number.isFinite(options.quality)?options.quality:.9;
 if(format==='application/pdf'){
   const jpeg=await canvasBlob('image/jpeg',quality),pdf=await jpegToPdf56(jpeg,w,h);
   download(pdf,base+'.pdf');toast('PDF exportado.');return pdf;
 }
 if(format==='image/svg+xml'){
   const png=await canvasBlob('image/png'),src=await blobToDataUrl(png);
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" href="${src}" /></svg>`;
   const blob=new Blob([svg],{type:'image/svg+xml'});download(blob,base+'.svg');toast('SVG exportado con imagen incrustada.');return blob;
 }
 const blob=await canvasBlob(format,quality);
 if(format==='image/webp' && blob.type!=='image/webp')throw Error('Este navegador no admite la exportación WebP.');
 const ext= format==='image/jpeg'?'jpg':format==='image/webp'?'webp':'png';download(blob,base+'.'+ext);
 if(['image/jpeg','image/png'].includes(format)&&!window.WSA_WEB_MODE)saveExportLocal55(blob,format).catch(e=>toast('Descarga correcta, pero el guardado adicional en carpeta falló: '+e.message));
 toast(`Archivo ${ext.toUpperCase()} exportado.`);return blob;
}
function download(blob,name){const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),15000);}
async function exportBackup(){await saveCurrent();status('Preparando respaldo…');try{const packed=[];for(const a of assets){const file=await fetchAssetBlob(a);packed.push({...a,blob:await blobToDataUrl(file)});}const backup={format:'wonder-studio-ai-backup',schema:1,created:new Date().toISOString(),projects,assets:packed,designs};download(new Blob([JSON.stringify(backup)],{type:'application/json'}),'wonder-studio-ai-respaldo-'+new Date().toISOString().slice(0,10)+'.json');status(window.WSA_WEB_MODE?'Guardado en nube':'Guardado en servidor','good');toast('Respaldo completo descargado. Guárdalo en otro dispositivo o en la nube.');}catch(e){status('Error al respaldar','bad');toast(e.message);}}
async function importBackup(file){let data;try{data=JSON.parse(await file.text());if(data.format!=='wonder-studio-ai-backup'||data.schema!==1||!Array.isArray(data.projects)||!Array.isArray(data.assets)||!Array.isArray(data.designs))throw new Error('Formato de respaldo no reconocido.');if(!await askConfirm('Importar respaldo',`Importar ${data.projects.length} proyectos, ${data.assets.length} archivos y ${data.designs.length} diseños. Los datos con igual identificador podrían sobrescribirse.`))return;const operations=[];for(const p of data.projects){if(typeof p.id!=='string')throw new Error('Proyecto inválido');operations.push({store:'projects',value:p});}for(const a of data.assets){if(typeof a.id!=='string'||typeof a.blob!=='string')throw new Error('Recurso inválido');operations.push({store:'assets',value:{...a,blob:dataUrlToBlob(a.blob)}});}for(const d of data.designs){if(typeof d.id!=='string'||!Array.isArray(d.layers))throw new Error('Diseño inválido');operations.push({store:'designs',value:d});}await queueDb(()=>batch(db,operations));for(const id of imageUrls.keys())releaseUrl(id);await refresh();currentProject=null;currentDesign=null;toast('Respaldo restaurado correctamente.');navigate('projects');}catch(e){toast('Error al importar: '+e.message)}}
async function refresh(){[projects,assets,designs]=await Promise.all(['projects','assets','designs'].map(x=>all(db,x)));}
function migrateOldDesign(old,project){const doc=new DOMParser().parseFromString('<div id="root">'+(old.html||'')+'</div>','text/html'),nodes=[...doc.querySelector('#root').children];const layers=nodes.map(node=>{const style=node.style;const layer={id:uid(),type:node.tagName==='IMG'?'image':node.classList.contains('artshape')?'shape':'text',x:parseFloat(style.left)||8,y:parseFloat(style.top)||20,w:parseFloat(style.width)||65,opacity:parseFloat(style.opacity)||1,rotation:0,shadow:'none',visible:true,locked:false};if(layer.type==='text')Object.assign(layer,{text:node.textContent||'',fontSize:parseInt(style.fontSize)||34,color:style.color||'#13233b',font:style.fontFamily||'Arial'});if(layer.type==='shape')Object.assign(layer,{h:18,color:style.backgroundColor||'#7390ff'});if(layer.type==='image'){const match=assets.find(x=>x._legacyData===node.getAttribute('src'));layer.assetId=match?.id||null;}return layer});return{id:old.id||uid(),project,name:old.name||'Diseño migrado',ratio:old.ratio||'1/1',bg:/^#[0-9a-f]{6}$/i.test(old.bg||'')?old.bg:'#dceeff',layers:layers.length?layers:defaultDesign(project).layers,created:old.created||Date.now(),updated:Date.now(),version:1};}
async function migrateLocalStorage(){const keys=['wsa_projects','wsa_assets','wsa_designs'];try{if(!keys.some(k=>localStorage.getItem(k)))return;}catch(e){return;}const done=await all(db,'settings');if(done.find(x=>x.id==='legacy-migrated'))return;if(projects.length||assets.length||designs.length)return;const oldProjects=JSON.parse(localStorage.getItem(keys[0])||'[]'),oldAssets=JSON.parse(localStorage.getItem(keys[1])||'[]'),oldDesigns=JSON.parse(localStorage.getItem(keys[2])||'[]');if(!Array.isArray(oldProjects)||!Array.isArray(oldAssets)||!Array.isArray(oldDesigns))return;const ops=[];for(const p of oldProjects)if(p.id)ops.push({store:'projects',value:p});for(const a of oldAssets){if(!a.id||!a.data)continue;try{const blob=dataUrlToBlob(a.data);const v={...a,blob};delete v.data;assets.push({...v,_legacyData:a.data});ops.push({store:'assets',value:v});}catch(e){console.warn('No se pudo migrar:',a.name,e)}}for(const d of oldDesigns){if(!d.project)continue;ops.push({store:'designs',value:migrateOldDesign(d,d.project)});}ops.push({store:'settings',value:{id:'legacy-migrated',at:Date.now()}});await batch(db,ops);assets=[];await refresh();toast('Se recuperaron datos de una versión anterior. Descarga un respaldo.');/* Keep original localStorage keys intact for safety. */}
async function renderStats(){let total=assets.reduce((n,a)=>n+(a.blob?.size||a.size||0),0);$('#storageStats').textContent=`${projects.length} proyectos · ${assets.length} recursos (${(total/1024/1024).toFixed(1)} MB) · ${designs.length} diseños. ${window.WSA_WEB_MODE?'Datos privados en Supabase: base PostgreSQL y Storage.':'Datos locales en SQLite y archivos privados.'} Descarga respaldos manualmente para mayor seguridad.`;}

async function loadProjectChat(){
 try {const chat=(await all(db,'settings')).find(x=>x.id==='chat-'+currentProject.id);
 if(chat?.messages?.length){chatHistory=chat.messages.slice(-40);$('#chatlog').replaceChildren();for(const msg of chatHistory){if(msg.role==='assistant')bot(msg.content);else user(msg.content);}}
 }catch(err){console.warn('Chat no recuperado:',err.message)}
}
async function loadProjectFonts(){
 const family=$('#fontFamily');
 for(const opt of [...family.querySelectorAll('[data-upload-font]')])opt.remove();
 for(const a of assets.filter(x=>x.project===currentProject.id&&(/\.(ttf|otf|woff2?)$/i.test(x.name)||(x.type||'').startsWith('font/')))){
  const name='WS '+a.name.replace(/[^a-zA-Z0-9 ]/g,' ').slice(0,35);
  try {const face=new FontFace(name,`url("${imgUrl(a)}")`);await face.load();document.fonts.add(face);
    const opt=document.createElement('option');opt.textContent=name;opt.value=name;opt.dataset.uploadFont='1';family.append(opt);
  }catch(e){console.warn('Tipografía no cargada:',a.name,e.message)}
 }
}
function setupAccountControls(){
 const top=document.querySelector('.topright');
 const userLabel=document.createElement('span');userLabel.className='account-label';userLabel.textContent=getUser()?.name||'Mi cuenta';top.prepend(userLabel);
 const change=document.createElement('button');change.className='secondary';change.textContent='⇄ Cambiar cuenta';change.title='Guardar tus diseños y entrar con otra cuenta';
 change.onclick=async()=>{try{await saveCurrent();await switchAccount()}catch(e){toast('No se pudo cambiar de cuenta: '+e.message)}};top.append(change);
 const btn=document.createElement('button');btn.className='secondary';btn.textContent='Salir';btn.onclick=async()=>{try{await saveCurrent();await logout()}catch(e){toast('No se pudo cerrar sesión: '+e.message)}};top.append(btn);
}
function setupProFeatures(){
 const tools=document.querySelector('.toolbar');
 const quick=document.createElement('button');quick.textContent='✦ Composición rápida';quick.title='Diseño editable con recursos del proyecto, sin conexión a IA';quick.onclick=quickComposition;tools.append(quick);
 const ai=document.createElement('button');ai.textContent='✧ Imagen con modelo local';ai.id='generateAI';ai.disabled=true;ai.title='Requiere ComfyUI local con un checkpoint instalado';ai.onclick=generateAIBackground;tools.append(ai);
 
 if(!window.WSA_WEB_MODE){const rev=document.createElement('button');rev.textContent='◷ Versiones';rev.onclick=showRevisions;tools.append(rev);}
 if(window.WSA_WEB_MODE){const box=document.createElement('div');box.className='panel pad';box.innerHTML='<h2>Edición web · Vercel + Supabase</h2><p>Los archivos se guardan de forma privada en tu cuenta de Supabase. Para generar imágenes con IA desde Internet se necesita configurar un servidor remoto dedicado; los motores locales de la versión de escritorio no son accesibles a visitantes de Vercel.</p><p>Para trasladar trabajos desde Windows, descarga un respaldo JSON en la edición de escritorio y usa Importar respaldo en esta cuenta web.</p>';document.querySelector('#settingsPage .settingsgrid').append(box);return;}
 const settings=document.querySelector('#settingsPage .settingsgrid .panel');
 if(settings){const box=document.createElement('div');box.className='servercard';
 box.innerHTML='<h3>Servidor, cuentas e IA</h3><p id="serverStatusText" class="helper"></p><div class="toolbar"><button id="serverExportZip" class="primary">↓ Respaldo ZIP del servidor</button><button id="serverImportZip" class="secondary">↑ Importar ZIP</button><input type="file" id="serverZipInput" accept=".zip,application/zip" class="hidden"></div><p class="helper">El ZIP es portátil, incluye tus recursos originales y no contiene contraseñas. Guárdalo fuera del servidor.</p><button id="migrateOld41" class="secondary">Importar datos de IndexedDB (v4.1)</button><p class="helper">Solo recupera datos de la v4.1 si se abrió en este mismo origen (dirección y puerto). Los originales no se eliminan.</p>';
 settings.append(box);box.querySelector('#migrateOld41').onclick=migrateOld41;box.querySelector('#serverExportZip').onclick=exportServerZip;box.querySelector('#serverImportZip').onclick=()=>$('#serverZipInput').click();box.querySelector('#serverZipInput').onchange=async e=>{const f=e.target.files[0];if(f)await importServerZip(f);e.target.value='';};
 box.querySelector('#serverStatusText').textContent=`Versión 5.5.1 escritorio. Usuario: ${getUser()?.email||'—'}. Chat local: ${hasAI()?'listo':'sin modelo'}. Tu contenido se guarda en la carpeta data/ del servidor local.`;
 const sec=document.createElement('section');sec.className='panel pad account-security';
 sec.innerHTML='<h2>Seguridad y recuperación de mi cuenta</h2><p class="helper">Si tu cuenta se creó antes de 5.3, genera aquí el primer código de recuperación usando tu contraseña actual. Guarda el código; no se volverá a mostrar.</p><label for="accountPwd">Contraseña actual</label><input id="accountPwd" type="password" autocomplete="current-password" placeholder="Tu contraseña actual"><button class="secondary" id="makeRecoveryCode" type="button">Generar mi código de recuperación</button><div id="recoveryOutput" class="hidden"><p class="helper">Código privado (guárdalo fuera de la aplicación):</p><div class="recovery-key" id="recoveryCurrentCode"></div><button class="secondary" id="copyRecoveryCode" type="button">Copiar código</button></div><p id="accountRecoveryStatus" role="status" class="helper"></p>';
 document.querySelector('#settingsPage .settingsgrid').append(sec);
 sec.querySelector('#makeRecoveryCode').onclick=async()=>{const pwd=sec.querySelector('#accountPwd').value;if(!pwd){sec.querySelector('#accountRecoveryStatus').textContent='Escribe tu contraseña actual.';return;}try{const r=await apiRequest('/api/recovery/regenerate',{method:'POST',body:JSON.stringify({password:pwd})});sec.querySelector('#accountPwd').value='';sec.querySelector('#recoveryCurrentCode').textContent=r.recovery_code;sec.querySelector('#recoveryOutput').classList.remove('hidden');sec.querySelector('#accountRecoveryStatus').textContent='Código generado. El código anterior dejó de funcionar.';}catch(e){sec.querySelector('#accountRecoveryStatus').textContent=e.message}};
 sec.querySelector('#copyRecoveryCode').onclick=()=>navigator.clipboard?.writeText(sec.querySelector('#recoveryCurrentCode').textContent);
 const aiBox=document.createElement('div');aiBox.className='servercard ai-config';
 aiBox.innerHTML=`<h3>✦ Inteligencia artificial instalada en este equipo</h3>
 <p class="helper">Wonder no requiere claves API ni servicios de IA externos. Para conversar y analizar imágenes utiliza <b>Ollama</b> con modelos descargados a la computadora. Para crear imágenes fotorrealistas usa <b>ComfyUI</b> y un checkpoint instalado localmente. Los modelos se descargan una vez y pueden necesitar bastante memoria; el editor funciona aunque no estén instalados.</p>
 <p id="aiStatus" role="status" class="helper">Buscando motores locales…</p>
 <div class="ai-manage" id="aiManage">
   <div class="twocol"><div><label for="aiTextModel">Modelo local de conversación (Ollama)</label><select id="aiTextModel"></select></div>
   <div><label for="aiVisionModel">Modelo local de visión (Ollama)</label><select id="aiVisionModel"></select></div></div>
   <label for="aiImageModel">Checkpoint de imágenes (ComfyUI)</label><select id="aiImageModel"></select>
   <div class="ai-actions"><button class="primary" id="aiSave" type="button">Guardar selección</button><button class="secondary" id="aiRefresh" type="button">↻ Detectar modelos</button></div>
 </div>
 <button class="secondary" id="aiTest" type="button">✓ Probar conversación local</button>
 <p class="helper">Para el chat de bajo consumo: instala <a href="https://ollama.com/download/windows" target="_blank" rel="noopener">Ollama para Windows</a>, ejecuta <code>ollama pull gemma3:1b</code> y pulsa «Detectar modelos». Para visión se necesita un modelo con soporte visual. Para imágenes: instala <a href="https://github.com/Comfy-Org/ComfyUI" target="_blank" rel="noopener">ComfyUI</a>, arráncalo localmente en el puerto 8188 y carga un checkpoint compatible con el workflow estándar.</p>
 <p class="helper">Estos motores solo se consultan en <code>127.0.0.1</code>. No se envían archivos ni mensajes a servicios en la nube. La instalación de modelos requiere espacio en disco y potencia suficiente; sin ellos se utiliza Composición rápida, que no equivale a generación por IA.</p>`;
 settings.append(aiBox);
 const aiStatus=aiBox.querySelector('#aiStatus'),aiSave=aiBox.querySelector('#aiSave'),aiTest=aiBox.querySelector('#aiTest');
 function optionsFor(sel,items,current,placeholder){sel.replaceChildren();sel.append(new Option(placeholder,''));for(const item of items)sel.append(new Option(item,item));sel.value=items.includes(current)?current:'';}
 async function loadAISettings(){
  try{
   const r=await apiRequest('/api/ai/config');setAIEnabled(!!r.chat_ready);
   localImageReady=!!r.image_ready;localVisionReady=!!r.vision_ready;
   aiStatus.textContent=`Chat: ${r.chat_ready?'✓ '+r.text_model:'sin modelo instalado'} · Visión: ${r.vision_ready?'✓ '+r.vision_model:'no configurada'} · Imágenes: ${r.image_ready?'✓ '+r.image_model:'sin ComfyUI/checkpoint'}`;
   optionsFor(aiBox.querySelector('#aiTextModel'),r.models||[],r.text_model,'No hay modelos de Ollama');
   optionsFor(aiBox.querySelector('#aiVisionModel'),r.models||[],r.vision_model,'Selecciona modelo multimodal');
   optionsFor(aiBox.querySelector('#aiImageModel'),r.checkpoints||[],r.image_model,'No hay checkpoints de ComfyUI');
   aiBox.querySelector('#aiManage').classList.toggle('hidden',!r.can_manage);
   const gen=$('#generateAI');if(gen){gen.disabled=!r.image_ready;gen.title=r.image_ready?'Crear fondo con ComfyUI instalado':'Inicia ComfyUI con un checkpoint local';}
   for(const button of document.querySelectorAll('.ai-analyze-button'))button.disabled=!r.vision_ready;
   return r;
  }catch(e){aiStatus.textContent='Error al consultar motores locales: '+e.message;}
 }
 aiSave.onclick=async()=>{aiSave.disabled=true;try{
   const payload={text_model:aiBox.querySelector('#aiTextModel').value,
    vision_model:aiBox.querySelector('#aiVisionModel').value,
    checkpoint:aiBox.querySelector('#aiImageModel').value};
   await apiRequest('/api/ai/config',{method:'POST',body:JSON.stringify(payload)});
   await loadAISettings();toast('Modelos locales seleccionados.');
  }catch(e){aiStatus.textContent='No se pudo guardar: '+e.message}finally{aiSave.disabled=false}};
 aiBox.querySelector('#aiRefresh').onclick=loadAISettings;
 aiTest.onclick=async()=>{aiTest.disabled=true;aiStatus.textContent='Consultando Ollama de esta computadora…';try{
   const r=await apiRequest('/api/ai/test',{method:'POST',body:'{}'});
   aiStatus.textContent='✓ Respuesta del modelo local: '+r.reply;toast('La IA local respondió correctamente.');
  }catch(e){aiStatus.textContent='No se pudo conectar al modelo: '+e.message}finally{aiTest.disabled=false}};
 loadAISettings();
 }

}
async function analyzeResource(asset,button){
 button.disabled=true;button.textContent='Analizando…';
 try{const result=await apiRequest('/api/ai/analyze',{method:'POST',body:JSON.stringify({asset_id:asset.id})});
 const v=result.analysis||{};
 const tags=Array.isArray(v.etiquetas)?v.etiquetas.filter(x=>typeof x==='string').slice(0,12):[];
 const matching=projectCategories(byId(projects,asset.project)).find(c=>cleanWord(c.name)===cleanWord(v.categoria));const cat=matching?.id||'General';
 if(await askConfirm('Análisis de IA',`ANÁLISIS DE IA\n\n${v.descripcion||''}\n\nCategoría sugerida: ${cat}\nEtiquetas: ${tags.join(', ')}\n\n¿Aplicar esta clasificación? La designación de logotipo oficial seguirá requiriendo tu confirmación.`)){
   asset.kind=cat;asset.suggestedKind=cat;asset.tags=[...new Set([...(asset.tags||[]),...tags])].slice(0,35);
   asset.visualAnalysis={description:String(v.descripcion||'').slice(0,1000),observations:String(v.observaciones||'').slice(0,1000),at:Date.now()};
   asset.reviewStatus='pending';await queueDb(()=>put(db,'assets',asset));renderLibrary();toast('Análisis guardado para revisión.');}
 }catch(err){toast('No se pudo analizar: '+err.message)}finally{button.disabled=!localVisionReady;button.textContent='✧ Analizar con IA';}
}
async function generateAIBackground(){
 if(!currentProject||!currentDesign)return;
 const promptText=await askText('Generar fondo con IA','Fotografía publicitaria elegante, iluminación de estudio, composición limpia con espacio para texto','Descripción del fondo');
 if(!promptText?.trim())return;
 const button=$('#generateAI');button.disabled=true;button.textContent='Generando imagen…';
 try {const result=await apiRequest('/api/ai/image',{method:'POST',body:JSON.stringify({project_id:currentProject.id,ratio:currentDesign.ratio,prompt:promptText.trim()})});
   const blob=dataUrlToBlob(result.image);
   const asset={id:uid(),project:currentProject.id,name:'Fondo IA '+new Date().toLocaleString('es-MX')+'.png',type:'image/png',size:blob.size,blob,kind:'Fondo',suggestedKind:'Fondo',reviewStatus:'pending',tags:['generado con IA'],logo:false,created:Date.now(),meta:{width:0,height:0,palette:[]},generationPrompt:promptText};
   await queueDb(()=>put(db,'assets',asset));delete asset.blob;assets.push(asset);
   history.push(snapshot());future=[];
   currentDesign.layers.unshift({id:uid(),type:'image',assetId:asset.id,x:0,y:0,w:100,opacity:1,rotation:0,shadow:'none',visible:true,locked:true});
   const logo=assets.find(a=>a.project===currentProject.id&&a.logo);
   if(logo&&!currentDesign.layers.some(l=>l.type==='image'&&l.assetId===logo.id))
     currentDesign.layers.push({id:uid(),type:'image',assetId:logo.id,x:72,y:4,w:23,opacity:1,rotation:0,shadow:'none',visible:true,locked:false});
   selectedId=currentDesign.layers[currentDesign.layers.length-1]?.id;
   markChange({record:false});await saveCurrent();renderStudio();toast('Fondo generado y guardado. Los textos y el logo siguen siendo capas editables.');
 }catch(err){toast('Generación no disponible: '+err.message)}finally{button.disabled=!localImageReady;button.textContent='✧ Imagen con modelo local';}
}
function composeFromInstructionLocal(brief){
 if(!currentProject||!currentDesign)return;
 const original=String(brief||'').trim().slice(0,450);
 const title=original.replace(/^(?:por favor\s+)?(?:crea|crear|haz|diseña|diseñar|necesito|quiero|hazme)\s+(?:(?:un|una|el|la)\s+)?(?:(?:diseño|post|publicación|anuncio|flyer|cartel|portada)\s+)?(?:para\s+)?/i,'').trim();
 const headline=(title||currentProject.name).slice(0,115);
 const style=original.toLowerCase();
 let colors=['#142643','#648afe'];
 if(/halloween|terror|misterio/.test(style))colors=['#241336','#ed953f'];
 else if(/navidad|diciembre|reyes/.test(style))colors=['#0f493d','#d4a748'];
 else if(/inaugura|apertura|lanzamiento|evento/.test(style))colors=['#10233a','#cda557'];
 else if(/verano|playa|mar|yate/.test(style))colors=['#103e65','#57bdd8'];
 else if(/oferta|descuento|promoción|buen fin/.test(style))colors=['#35152d','#fb7b53'];
 const candidates=assets.filter(a=>a.project===currentProject.id&&previewableAsset(a)&&!a.logo);
 const words=original.toLowerCase().split(/\W+/).filter(w=>w.length>=4);
 const sample=[...candidates].sort((a,b)=>{
  const score=x=>words.reduce((n,w)=>n+((x.name+' '+(x.tags||[]).join(' ')).toLowerCase().includes(w)?1:0),0);
  return score(b)-score(a);
 })[0];
 const logo=assets.find(a=>a.project===currentProject.id&&a.logo);
 history.push(snapshot());future=[];currentDesign.bg=colors[0];currentDesign.layers=[];
 if(sample)currentDesign.layers.push({id:uid(),type:'image',assetId:sample.id,x:38,y:10,w:60,opacity:.95,rotation:0,shadow:'soft',visible:true,locked:false});
 currentDesign.layers.push({id:uid(),type:'shape',x:0,y:67,w:100,h:33,color:colors[0],opacity:.92,rotation:0,shadow:'none',visible:true,locked:false});
 currentDesign.layers.push({id:uid(),type:'shape',x:6,y:66,w:21,h:1.5,color:colors[1],opacity:1,rotation:0,shadow:'none',visible:true,locked:false});
 currentDesign.layers.push({id:uid(),type:'text',text:headline.toUpperCase(),x:6,y:72,w:88,fontSize:Math.min(36,headline.length>54?24:36),color:'#ffffff',font:'Arial',opacity:1,rotation:0,shadow:'soft',visible:true,locked:false});
 if(logo)currentDesign.layers.push({id:uid(),type:'image',assetId:logo.id,x:5,y:5,w:22,opacity:1,rotation:0,shadow:'soft',visible:true,locked:false});
 selectedId=currentDesign.layers.find(l=>l.type==='text')?.id;
 markChange({record:false});renderStudio();
}
async function quickComposition(){
 if(!currentProject||!currentDesign)return;
 const headline=await askText('Composición rápida',currentProject.name.toUpperCase(),'Título principal');if(!headline?.trim())return;
 const subtitle=await askText('Subtítulo','Conoce nuestras novedades','Texto complementario')||'';
 const logo=assets.find(a=>a.project===currentProject.id&&a.logo);
 const sample=assets.find(a=>a.project===currentProject.id&&previewableAsset(a)&&!a.logo);
 const colors=assets.filter(a=>a.project===currentProject.id).flatMap(a=>a.meta?.palette||[]);
 const bg=colors.find(c=>/^#[0-9a-f]{6}$/i.test(c))||'#162440';
 const contrast=(hex)=>{const x=hex.replace('#','');const rgb=[0,2,4].map(i=>parseInt(x.slice(i,i+2),16));return (rgb[0]*0.299+rgb[1]*0.587+rgb[2]*0.114)>160?'#111c31':'#ffffff';};
 history.push(snapshot());future=[];currentDesign.bg=bg;currentDesign.name=(headline||'Diseño nuevo').trim().slice(0,75);
 currentDesign.layers=[];
 if(sample){currentDesign.layers.push({id:uid(),type:'image',assetId:sample.id,x:42,y:6,w:55,opacity:.9,rotation:0,shadow:'none',visible:true,locked:false});}
 currentDesign.layers.push({id:uid(),type:'shape',x:0,y:67,w:100,h:33,color:'#101d36',opacity:.88,rotation:0,shadow:'none',visible:true,locked:false});
 currentDesign.layers.push({id:uid(),type:'text',text:headline.trim().toUpperCase(),x:6,y:68,w:85,fontSize:35,color:'#ffffff',font:'Arial',opacity:1,rotation:0,shadow:'soft',visible:true,locked:false});
 if(subtitle.trim())currentDesign.layers.push({id:uid(),type:'text',text:subtitle.trim(),x:6,y:83,w:85,fontSize:17,color:'#d4dfff',font:'Arial',opacity:1,rotation:0,shadow:'none',visible:true,locked:false});
 if(logo){currentDesign.layers.push({id:uid(),type:'image',assetId:logo.id,x:5,y:5,w:23,opacity:1,rotation:0,shadow:'none',visible:true,locked:false});}
 selectedId=currentDesign.layers.find(l=>l.type==='text')?.id||currentDesign.layers[0].id;
 markChange({record:false});renderBoard();toast('Composición editable creada con recursos del proyecto.');
}
async function showRevisions(){
 if(!currentDesign)return;await saveCurrent();
 try{const data=await apiRequest('/api/revisions/'+currentDesign.id);
 if(!data.items.length){toast('Este diseño todavía no tiene versiones anteriores. Edita y guarda para crear historial.');return;}
 const list=data.items.map((r,i)=>`${i+1}. ${new Date(r.saved*1000).toLocaleString('es-MX')}`).join('\n');
 const selected=await askChoice('Restaurar versión',data.items.map((v,i)=>({label:`${i+1}. ${new Date(v.saved).toLocaleString('es-MX')}`,value:String(i+1)})));
 if(selected===null)return;const index=Number(selected)-1;if(!Number.isInteger(index)||!data.items[index]){toast('Número de versión inválido.');return;}
 if(!await askConfirm('Restaurar versión','Se conservará una copia de seguridad de la versión actual.'))return;
 const restored=await apiRequest('/api/revisions/'+currentDesign.id+'/restore',{method:'POST',body:JSON.stringify({revision_id:data.items[index].id})});
 currentDesign=restored.design;const at=designs.findIndex(d=>d.id===currentDesign.id);if(at>=0)designs[at]=structuredClone(currentDesign);
 selectedId=currentDesign.layers[0]?.id||null;dirty=false;history=[];future=[];renderStudio();toast('Versión anterior restaurada.');
 }catch(e){toast('No se pudo restaurar: '+e.message)}
}
async function exportServerZip(){
 await saveCurrent();const btn=$('#serverExportZip');btn.disabled=true;btn.textContent='Preparando ZIP…';
 try{const r=await fetch('/api/backup/archive',{credentials:'same-origin'});
   if(!r.ok){const obj=await r.json();throw new Error(obj.error||'El respaldo no está disponible')}
   const blob=await r.blob();download(blob,'wonder-studio-respaldo-'+new Date().toISOString().slice(0,10)+'.zip');
   toast('Respaldo ZIP creado. Guárdalo también en un dispositivo externo.');
 }catch(e){toast('No se pudo respaldar: '+e.message)}finally{btn.disabled=false;btn.textContent='↓ Respaldo ZIP del servidor';}
}
async function importServerZip(file){
 if(!await askConfirm('Importar respaldo ZIP','Los objetos con identificadores iguales se sobrescribirán. Antes exporta un respaldo.'))return;
 const btn=$('#serverImportZip');btn.disabled=true;btn.textContent='Restaurando…';status('Importando respaldo…');
 try{const r=await fetch('/api/backup/archive',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/zip','X-CSRF-Token':getCsrf()},body:file});
   const result=await r.json();if(!r.ok)throw new Error(result.error||'No se pudo importar el ZIP');
   for(const id of imageUrls.keys())releaseUrl(id);
   await refresh();currentProject=null;currentDesign=null;await navigate('projects');
   status(window.WSA_WEB_MODE?'Guardado en nube':'Guardado en servidor','good');toast(`Se restauraron ${result.count} registros desde ZIP.`);
 }catch(e){status('Error al importar','bad');toast('No se pudo importar: '+e.message)}finally{btn.disabled=false;btn.textContent='↑ Importar ZIP';}
}
async function migrateOld41(){
 try{const data=await legacy41();if(!data){toast('No se encontró un almacén IndexedDB v4.1 en este mismo origen. Usa Importar respaldo JSON si lo tienes.');return;}
 const total=data.projects.length+data.assets.length+data.designs.length;
 if(!total){toast('El almacén v4.1 está vacío.');return;}
 if(!await askConfirm('Recuperar proyectos',`Encontramos ${data.projects.length} proyectos, ${data.assets.length} recursos y ${data.designs.length} diseños antiguos. Los originales se conservarán.`))return;
 status('Migrando datos…');
 await batch(db,[...data.projects.map(value=>({store:'projects',value})),...data.assets.map(value=>({store:'assets',value})),...data.designs.map(value=>({store:'designs',value}))]);
 await refresh();await navigate('projects');status(window.WSA_WEB_MODE?'Guardado en nube':'Guardado en servidor','good');toast('Datos de v4.1 importados. Exporta un respaldo para mayor seguridad.');
 }catch(e){status('Error al migrar','bad');toast('Error de migración: '+e.message)}
}

// Wonder Studio 5.5: transformaciones editables y organización; sin simular inpainting o segmentación.
let activeLibraryFolder55='',advancedShowing55=false;
function updateContext55(){
 const l=selected(),box=$('#context55');if(!box)return;
 box.classList.toggle('hidden',!l);
 $('#contextType55').textContent=l?.type==='text'?'TEXTO':l?.type==='image'?'IMAGEN':l?.type==='shape'?'FORMA':'ELEMENTO';
 $('#contextText55').classList.toggle('hidden',l?.type!=='text');
 $('#contextImage55').classList.toggle('hidden',l?.type!=='image');
 if(!l)return;
 if(l.type==='text'){
  $('#ctxSize55').value=l.fontSize||34;$('#ctxColor55').value=l.color||'#13233b';
  $('#ctxFont55').value=l.font||'Arial';$('#ctxEffect55').value=l.effect||'none';
  for(const [k,v] of [['Bold',l.bold!==false],['Italic',l.italic],['Underline',l.underline],['Strike',l.strike]])$('#ctx'+k+'55').classList.toggle('on',!!v);
 }
 if(l.type==='image')$('#ctxPin55').textContent=l.pinned?'Desanclar fondo':'📌 Anclar al fondo';
}
function syncAdvanced55(){
 const l=selected();if(!l)return;
 const values={posX55:l.x,posY55:l.y,posW55:l.w,posH55:l.h||18,posR55:l.rotation||0,posO55:Math.round((l.opacity??1)*100),
  imgRadius55:l.radius||0,imgStroke55:l.strokeWidth||0,imgStrokeColor55:l.strokeColor||'#ffffff',imgFit55:l.fit||'contain',imgFilter55:l.imgFilter||'none',imgCropX55:l.cropX??50,imgCropY55:l.cropY??50,imgZoom55:l.zoom||100};
 for(const [id,v] of Object.entries(values)){const input=$('#'+id);if(input)input.value=v;}
 $('#imageOptions55').classList.toggle('hidden',l.type!=='image');
}
function reorderLayer55(from,to){const layers=currentDesign?.layers||[],i=layers.findIndex(x=>x.id===from),j=layers.findIndex(x=>x.id===to);if(i<0||j<0||i===j)return;history.push(snapshot());future=[];const [moving]=layers.splice(i,1);layers.splice(j,0,moving);markChange({record:false});renderBoard();}
function putSelected55(changes){modifySelected(l=>Object.assign(l,changes));}
function addTextPreset55(kind){addLayer('text');const specs={title:{text:'Agregar un título',fontSize:50,w:85,h:16,bold:true},subtitle:{text:'Agregar un subtítulo',fontSize:29,w:76,h:13,bold:true},body:{text:'Agregar algo de texto',fontSize:18,w:75,h:18,bold:false}};putSelected55(specs[kind]);}
function modifySelectedId55(id,changes){const l=byId(currentDesign?.layers||[],id);if(!l||l.locked)return false;history.push(snapshot());future=[];Object.assign(l,changes);markChange({record:false});renderBoard();return true;}
function setBackground55(){
 const l=selected();if(!l||l.type!=='image')return;
 history.push(snapshot());future=[];
 if(l.pinned){l.pinned=false;l.locked=false;l.w=50;l.h=45;l.x=20;l.y=20;}
 else {l.pinned=true;l.locked=true;l.x=0;l.y=0;l.w=100;l.h=100;l.fit='cover';const i=currentDesign.layers.indexOf(l);currentDesign.layers.splice(i,1);currentDesign.layers.unshift(l);}
 markChange({record:false});renderBoard();toast(l.pinned?'Imagen anclada como fondo. Puedes desbloquearla en Capas.':'Imagen desvinculada del fondo.');
}
async function replaceImage55(){const l=selected();if(!l||l.type!=='image')return;const candidates=assets.filter(a=>a.project===currentProject.id&&previewableAsset(a));if(!candidates.length)return toast('No hay imágenes en la biblioteca.');const list=candidates.slice(0,25).map((a,i)=>`${i+1}. ${a.name}`).join('\n');const choice=await askChoice('Reemplazar imagen',candidates.slice(0,25).map((a,i)=>({label:a.name,value:String(i)})));const i=Number(choice);if(choice===null)return;if(candidates[i])putSelected55({assetId:candidates[i].id});}
function frontBack55(where){const ls=currentDesign.layers,l=selected();if(!l)return;history.push(snapshot());future=[];const i=ls.indexOf(l);ls.splice(i,1);ls.splice(where==='front'?ls.length:0,0,l);markChange({record:false});renderBoard();}
async function saveExportLocal55(blob,format){const b64=(await blobToDataUrl(blob)).split(',')[1];const res=await apiRequest('/api/design-export/'+encodeURIComponent(currentDesign.id),{method:'POST',body:JSON.stringify({image:b64,type:format==='image/jpeg'?'jpg':'png'})});return res.path;}
async function storagePathUpdate55(){const p=byId(projects,$('#storageProject55').value);if(!p)return;const path=$('#storagePath55').value.trim();p.storagePath=path;try{await queueDb(()=>put(db,'projects',p));$('#storageHelp55').textContent='Ubicación guardada. La carpeta anterior se conserva por seguridad.';toast('Ubicación guardada para '+p.name);}catch(e){toast('No se pudo guardar la ruta: '+e.message)}}
function renderStorage55(){const sel=$('#storageProject55'),v=sel.value;sel.replaceChildren();for(const p of projects)sel.append(new Option(p.name,p.id));if(byId(projects,v))sel.value=v;const p=byId(projects,sel.value);$('#storagePath55').value=p?.storagePath||'';$('#storagePath55').placeholder=p?`Predeterminada: Documentos/ Wonder Studio AI / ${p.name}`:'Crea primero un proyecto';}
function setupEditor55(){
 $('#newTitle55').onclick=()=>addTextPreset55('title');$('#newSubtitle55').onclick=()=>addTextPreset55('subtitle');$('#newBody55').onclick=()=>addTextPreset55('body');
 $('#tabText55').onclick=()=>{$('#textSettings').scrollIntoView({block:'nearest'});$('#newTitle55').focus()};
 $('#tabImage55').onclick=()=>{$('#studioAssets').scrollIntoView({block:'nearest'});};
 $('#tabLayers55').onclick=()=>$('#layers').scrollIntoView({block:'nearest'});
 $('#newBadge55').onclick=()=>createDerivedResource55('badge');$('#newMockup55').onclick=()=>createDerivedResource55('mockup');
 const mods={ctxBold55:l=>l.bold=!(l.bold!==false),ctxItalic55:l=>l.italic=!l.italic,ctxUnderline55:l=>l.underline=!l.underline,ctxStrike55:l=>l.strike=!l.strike,
 ctxAlign55:l=>l.align= l.align==='center'?'right':l.align==='right'?'left':'center'};
 for(const [id,fn] of Object.entries(mods))$('#'+id).onclick=()=>modifySelected(fn);
 for(const [id,prop,transform] of [['ctxSize55','fontSize',Number],['ctxColor55','color',String],['ctxFont55','font',String],['ctxEffect55','effect',String]])$('#'+id).onchange=e=>putSelected55({[prop]:transform(e.target.value)});
 $('#ctxPin55').onclick=setBackground55;$('#ctxReplace55').onclick=replaceImage55;
 $('#ctxCrop55').onclick=()=>{advancedShowing55=true;$('#position55').classList.remove('hidden');$('#imageOptions55').classList.remove('hidden');$('#imgCropX55').focus();};
 $('#ctxFlipH55').onclick=()=>modifySelected(l=>l.flipH=!l.flipH);$('#ctxFlipV55').onclick=()=>modifySelected(l=>l.flipV=!l.flipV);
 $('#ctxRemoveBg55').onclick=removeBackground55;
 $('#ctxMagic55').onclick=()=>toast('El borrador inteligente requiere un modelo local de inpainting. Aún no está conectado.');
 $('#ctxErase55').onclick=pixelEraser55;
 $('#ctxPosition55').onclick=()=>{advancedShowing55=!advancedShowing55;$('#position55').classList.toggle('hidden',!advancedShowing55);};
 $('#showAdvanced55').onclick=$('#ctxPosition55').onclick;
 $('#ctxDuplicate55').onclick=()=>$('#duplicateLayer').click();
 const numeric=[['posX55','x'],['posY55','y'],['posW55','w'],['posH55','h'],['posR55','rotation']];
 for(const [id,key] of numeric)$('#'+id).onchange=e=>putSelected55({[key]:Number(e.target.value)});
 $('#posO55').onchange=e=>putSelected55({opacity:Number(e.target.value)/100});
 for(const [id,key,parser] of [['imgRadius55','radius',Number],['imgStroke55','strokeWidth',Number],['imgStrokeColor55','strokeColor',String],['imgFit55','fit',String],['imgFilter55','imgFilter',String],['imgCropX55','cropX',Number],['imgCropY55','cropY',Number],['imgZoom55','zoom',Number]])$('#'+id).onchange=e=>putSelected55({[key]:parser(e.target.value)});
 $('#alignCenter55').onclick=()=>modifySelected(l=>{l.x=(100-l.w)/2;l.y=(100-(l.h||18))/2});
 $('#alignTop55').onclick=()=>modifySelected(l=>l.y=0);$('#alignBottom55').onclick=()=>modifySelected(l=>l.y=100-(l.h||18));
 $('#posFront55').onclick=()=>frontBack55('front');$('#posBack55').onclick=()=>frontBack55('back');
 $('#storageProject55').onchange=renderStorage55;$('#saveStorage55').onclick=storagePathUpdate55;
 $('#openStorage55').onclick=async()=>{const p=$('#storageProject55').value;if(!p)return;try{const res=await apiRequest('/api/project-folder/'+p+'/open',{method:'POST',body:'{}'});toast('Carpeta abierta: '+res.path);}catch(e){toast(e.message)}};
 document.querySelector('.nav[data-page="settings"]').addEventListener('click',()=>setTimeout(renderStorage55,50));
}
function folders55(project){
 const list=new Map();
 for(const a of assets.filter(x=>x.project===project.id)){
  const f=a.folderPath||'';if(f){const root=f.split('/')[0];list.set(root,(list.get(root)||0)+1);}
 }
 for(const name of project.customFolders||[])if(!list.has(name))list.set(name,0);
 return [...list.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function renderFolders55(){const p=getLibraryProject(),host=$('#folderGrid55');if(!host)return;host.replaceChildren();if(!p)return;
 const make=(name,count,virtual)=>{
  const d=el('div',{class:'folder55'+(activeLibraryFolder55===name?' active':'')});
  d.append(el('span',{class:'folder55-icon',text:'📁'}),el('strong',{text:name}),el('small',{text:count+' recursos'}));
  const btn=el('button',{class:'folder55-more',title:'Opciones',text:'⋮'});
  btn.onclick=e=>{e.stopPropagation();folderMenu55(p,name,virtual,d);};d.onclick=()=>{activeLibraryFolder55=activeLibraryFolder55===name?'':name;
    if(virtual){$('#assetFilter').value=activeLibraryFolder55||'all';}
    else{const f=$('#assetFolderFilter');f.value=activeLibraryFolder55||'all';}
    renderLibrary();};d.append(btn);host.append(d);
 };
 for(const c of projectCategories(p)){const n=assets.filter(a=>a.project===p.id&&a.kind===c.id).length;if(n)make(c.name,n,true);}
 for(const [name,count] of folders55(p))make(name,count,false);
 if(!host.children.length)host.append(el('div',{class:'empty',text:'Aún no hay carpetas. Puedes crear una o subir una carpeta completa.'}));
}
function folderMenu55(p,name,virtual,container){
 document.querySelectorAll('.folder-popup55').forEach(x=>x.remove());
 const menu=el('div',{class:'folder-popup55'});
 const actions=[['Abrir carpeta',()=>container.click()],['Información',()=>folderActions55(p,name,virtual,'1')],
 ['Crear una copia',()=>folderClone55(p,name,virtual)],['Descargar ZIP',()=>downloadFolder55(p,name,virtual)],
 ['Mover / renombrar',()=>folderActions55(p,name,virtual,'2')],['Compartir ZIP',()=>downloadFolder55(p,name,virtual)],
 ['Agregar a favoritos',()=>folderActions55(p,name,virtual,'4')],['Eliminar carpeta',()=>folderActions55(p,name,virtual,'5')]];
 for(const [label,fn] of actions){if(virtual&&['Mover / renombrar','Eliminar carpeta'].includes(label))continue;
 const b=el('button',{text:label});b.onclick=ev=>{ev.stopPropagation();menu.remove();fn();};menu.append(b);}
 container.append(menu);
 const close=ev=>{if(!container.contains(ev.target)){menu.remove();document.removeEventListener('pointerdown',close)}};
 setTimeout(()=>document.addEventListener('pointerdown',close),0);
}
async function downloadFolder55(p,name,virtual){
 try{const categoryId=projectCategories(p).find(c=>c.name===name)?.id||'';
  const query=new URLSearchParams({project_id:p.id});if(virtual)query.set('category',categoryId);else query.set('folder',name);
  if(window.WSA_WEB_MODE){
   const list=assets.filter(a=>a.project===p.id&&(virtual?a.kind===categoryId:(a.folderPath===name||a.folderPath?.startsWith(name+'/'))));
   const entries=[];for(const a of list){const path=virtual?`${name}/${a.name}`:(a.relativePath||`${a.folderPath||name}/${a.name}`);entries.push({name:path,blob:await fetchAssetBlob(a)})}
   if(!entries.length)throw Error('La carpeta no contiene archivos para descargar.');
   const archive=await createZip56(entries);download(archive,name.replace(/[\\/:*?"<>|]/g,'_')+'.zip');toast('Carpeta ZIP descargada.');return;
  }const r=await fetch('/api/folder-export?'+query,{credentials:'same-origin'});if(!r.ok)throw Error((await r.json()).error||'Error de ZIP');
  download(await r.blob(),name.replace(/[\\/:*?"<>|]/g,'_')+'.zip');toast('Carpeta exportada a ZIP.');
 }catch(e){toast(e.message);}
}
async function folderClone55(p,name,virtual){
 const next=(await askText('Copiar carpeta',name+' (copia)','Nombre de la carpeta'))?.trim();if(!next)return;
 if(virtual)return toast('Para copiar una categoría utiliza Administrar categorías.');
 const originals=assets.filter(a=>a.project===p.id&&(a.folderPath===name||a.folderPath?.startsWith(name+'/')));
 if(originals.length>100)return toast('Esta carpeta es demasiado grande para la copia rápida. Usa Descargar ZIP.');
 let count=0;
 for(const a of originals){const blob=await fetchAssetBlob(a);const newPath=next+(a.folderPath||'').slice(name.length);
  const copy={...a,id:uid(),folderPath:newPath,relativePath:a.relativePath?.startsWith(name)?next+a.relativePath.slice(name.length):a.relativePath,
   blob,name:a.name,created:Date.now(),logo:false};
  await queueDb(()=>put(db,'assets',copy));delete copy.blob;assets.push(copy);count++;
 }
 p.customFolders=[...new Set([...(p.customFolders||[]),next])];await queueDb(()=>put(db,'projects',p));renderLibrary();toast(`Carpeta copiada con ${count} archivos.`);
}
async function folderActions55(p,name,virtual,choice){
 if(choice==='1'){const matching=assets.filter(a=>a.project===p.id&&(virtual?catName(p,a.kind)===name:(a.folderPath||'').startsWith(name)));showInfo('Información de carpeta',`${name}\nArchivos: ${matching.length}\nProyecto: ${p.name}`);}
 else if(choice==='2'&&!virtual){const next=(await askText('Renombrar carpeta',name,'Nombre de la carpeta'))?.trim();if(!next||next.includes('/')||next.includes('\\'))return;renameFolder55(p,name,next);}
 else if(choice==='3')downloadFolder55(p,name,virtual);
 else if(choice==='4'){p.favoriteFolders=p.favoriteFolders||[];p.favoriteFolders=[...new Set([...p.favoriteFolders,name])];queueDb(()=>put(db,'projects',p)).then(()=>toast('Carpeta marcada como favorita.'));}
 else if(choice==='5'&&!virtual){if(assets.some(a=>a.project===p.id&&(a.folderPath||'').startsWith(name)))return toast('La carpeta contiene archivos; primero muévelos para conservarlos.');p.customFolders=(p.customFolders||[]).filter(x=>x!==name);queueDb(()=>put(db,'projects',p)).then(renderFolders55);}
}
async function renameFolder55(p,name,next){
 const affected=assets.filter(a=>a.project===p.id&&(a.folderPath===name||a.folderPath?.startsWith(name+'/')));
 const ops=affected.map(a=>({store:'assets',value:{...a,folderPath:next+a.folderPath.slice(name.length),relativePath:a.relativePath?.startsWith(name)?next+a.relativePath.slice(name.length):a.relativePath}}));
 if(ops.length)await queueDb(()=>batch(db,ops));
 affected.forEach(a=>{a.folderPath=next+a.folderPath.slice(name.length);if(a.relativePath?.startsWith(name))a.relativePath=next+a.relativePath.slice(name.length)});
 p.customFolders=[...new Set([...(p.customFolders||[]).filter(x=>x!==name),next])];await queueDb(()=>put(db,'projects',p));activeLibraryFolder55=next;renderLibrary();
}
function setupLibrary55(){
 const workflow=$('#uploadWorkflow');workflow.remove();document.querySelector('.library55-bar').after(workflow);
 workflow.classList.add('hidden');$('#filterPanel55').remove();
 const filters=$('.libraryfilters');filters.classList.add('hidden');
 $('#toggleUpload55').onclick=()=>$('#uploadDropdown55').classList.toggle('hidden');
 $('#uploadFiles55').onclick=()=>{$('#uploadDropdown55').classList.add('hidden');$('#fileInput').click()};
 $('#uploadFolder55').onclick=()=>{$('#uploadDropdown55').classList.add('hidden');$('#folderInput').click()};
 $('#toggleClassify55').onclick=()=>$('#classifyPopup55').classList.toggle('hidden');
 $('#toggleFilters55').onclick=()=>filters.classList.toggle('hidden');
 $('#autoClassify55').onchange=()=>{$('#assetType').value=$('#autoClassify55').checked?'auto':$('#autoCategory55').value;};
 $('#autoCategory55').onchange=e=>{$('#autoClassify55').checked=false;$('#assetType').value=e.target.value;};
 $('#newFolder55').onclick=async()=>{const p=getLibraryProject();if(!p)return toast('Selecciona un proyecto');const name=(await askText('Nueva carpeta','','Nombre de la carpeta'))?.trim();if(!name||name.includes('..')||name.includes('\\'))return; p.customFolders=[...new Set([...(p.customFolders||[]),name])];await queueDb(()=>put(db,'projects',p));renderFolders55();};
 // Display confirmation only for a staged upload, not a permanent 3-step form.
 const prior=window.stageFiles;
}
function refreshLibrary55(){const p=getLibraryProject();if(!p)return;categoryOptions($('#autoCategory55'),p,{value:$('#autoCategory55').value||'General'});const sel=$('#assetFolderFilter');for(const name of p.customFolders||[]){if(![...sel.options].some(x=>x.value===name))sel.append(new Option(name,name));}renderFolders55();}
async function createDerivedResource55(kind){
 if(!currentDesign||!currentProject)return;
 if(kind==='badge'){
  const word=await askText('Nuevo recurso gráfico','OFERTA ESPECIAL','Texto del elemento');if(!word)return;
  addLayer('shape');putSelected55({x:28,y:12,w:44,h:13,color:'#ed348f',radius:14,name:'Sello promocional'});
  addLayer('text');putSelected55({x:29,y:15,w:44,h:11,text:word,fontSize:25,color:'#ffffff',font:'Arial',align:'center',bold:true,name:'Texto del sello'});
 }else if(kind==='mockup'){
  const logos=assets.filter(a=>a.project===currentProject.id&&previewableAsset(a));
  if(!logos.length)return toast('Sube primero una imagen o logotipo a la biblioteca.');
  const official=logos.find(x=>x.logo)||logos[0];
  addLayer('shape');putSelected55({x:12,y:10,w:78,h:68,color:'#e9edf6',radius:14,name:'Soporte del mockup'});
  addLayer('image',official.id);putSelected55({x:28,y:28,w:48,h:30,fit:'contain',name:'Logo sobre soporte'});
  addLayer('text');putSelected55({text:'VISTA DE MARCA',x:24,y:72,w:58,h:8,fontSize:22,align:'center',color:'#172548',name:'Pie del mockup'});
  toast('Mockup esquemático editable creado. Para un mockup fotográfico se necesita un modelo generativo local.');
 }
}
async function saveEditedImage55(asset,blob,label){
 const file=new File([blob],label+'.png',{type:'image/png'});const meta=await inspect(file);
 const record={id:uid(),project:currentProject.id,name:file.name,type:'image/png',size:file.size,blob:file,meta,kind:'Elemento',suggestedKind:'Elemento',reviewStatus:'approved',tags:['editado','derivado'],origin:'manual',sourceAssetId:asset.id,created:Date.now()};
 await queueDb(()=>put(db,'assets',record));delete record.blob;assets.push(record);putSelected55({assetId:record.id});return record;
}
async function removeBackground55(){const layer=selected(),asset=byId(assets,layer?.assetId);if(!asset)return;
 const button=$('#ctxRemoveBg55');button.disabled=true;button.textContent='Procesando…';
 try{const r=await apiRequest('/api/ai/remove-bg',{method:'POST',body:JSON.stringify({asset_id:asset.id})});
 const bytes=Uint8Array.from(atob(r.image),c=>c.charCodeAt(0));await saveEditedImage55(asset,new Blob([bytes],{type:'image/png'}),asset.name.replace(/\.[^.]+$/,'')+'-sin-fondo');toast('Fondo eliminado; original conservado en la biblioteca.');}
 catch(e){toast('No se pudo quitar el fondo: '+e.message)}finally{button.disabled=false;button.textContent='Quitar fondo'}
}
async function pixelEraser55(){
 const layer=selected(),asset=byId(assets,layer?.assetId);if(!asset)return;
 const modal=el('div',{class:'eraser-backdrop55'});const dialog=el('div',{class:'eraser-dialog55'});
 dialog.innerHTML='<h3>Borrador manual de píxeles</h3><p class="helper">Pinta las zonas que quieras convertir en transparentes. Se crea una copia, conservando el original.</p><label>Grosor <input type="range" id="eraserSize55" min="5" max="150" value="36"></label><div class="eraser-canvas-wrapper55"><canvas id="eraserCanvas55"></canvas></div><div class="editor55-actions"><button class="primary" id="saveEraser55">Guardar como recurso</button><button id="cancelEraser55">Cancelar</button></div>';
 modal.append(dialog);document.body.append(modal);
 dialog.querySelector('#cancelEraser55').onclick=()=>modal.remove();
 const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 try{const img=new Image();img.src=imgUrl(asset);await img.decode();const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);ctx.drawImage(img,0,0,canvas.width,canvas.height);}catch(e){modal.remove();return toast('No se pudo abrir el recurso: '+e.message)}
 let painting=false,last=null;
 const erase=e=>{const r=canvas.getBoundingClientRect();const x=(e.clientX-r.left)*canvas.width/r.width,y=(e.clientY-r.top)*canvas.height/r.height;const size=+dialog.querySelector('#eraserSize55').value*canvas.width/r.width;
  ctx.globalCompositeOperation='destination-out';ctx.lineWidth=size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();if(last)ctx.moveTo(last.x,last.y);else ctx.moveTo(x,y);ctx.lineTo(x,y);ctx.stroke();ctx.globalCompositeOperation='source-over';last={x,y};};
 canvas.onpointerdown=e=>{painting=true;canvas.setPointerCapture(e.pointerId);last=null;erase(e)};
 canvas.onpointermove=e=>{if(painting)erase(e)};canvas.onpointerup=()=>{painting=false;last=null};canvas.onpointercancel=()=>{painting=false;last=null};
 dialog.querySelector('#saveEraser55').onclick=()=>canvas.toBlob(async blob=>{if(!blob)return toast('No se pudo guardar');try{await saveEditedImage55(asset,blob,asset.name.replace(/\.[^.]+$/,'')+'-borrado');modal.remove();toast('Recurso editable guardado.');}catch(e){toast(e.message)}},'image/png');
}
function applyPlan55(actions){
 const old=currentDesign.layers,known= new Set(old.map(l=>l.id));if(!Array.isArray(actions))return 0;
 let count=0;history.push(snapshot());future=[];
 for(const action of actions.slice(0,15)){
  if(action.op==='set'&&known.has(action.id)){
   const layer=byId(old,action.id);if(layer.locked)continue;
   const valid=['x','y','w','h','fontSize','color','text','rotation','opacity','fit','flipH','flipV','radius','strokeWidth','strokeColor','effect','align','bold','italic','underline','strike'];
   for(const [k,v] of Object.entries(action.props||{}))if(valid.includes(k)){
    if(['x','y','w','h','fontSize','rotation','opacity'].includes(k)&&typeof v==='number'&&Number.isFinite(v)){layer[k]=k==='opacity'?Math.max(0,Math.min(1,v)):Math.max(-360,Math.min(360,v));}
    else if(typeof v==='string'||typeof v==='boolean')layer[k]=v;
   }count++;
  }else if(action.op==='add_text'||action.op==='add_shape'){
   const isText=action.op==='add_text';const layer={id:uid(),type:isText?'text':'shape',x:20,y:20,w:65,h:16,opacity:1,visible:true,locked:false,rotation:0,shadow:'none'};
   if(isText)Object.assign(layer,{text:action.text||'Nuevo texto',fontSize:36,color:'#13233b',font:'Arial'});
   else Object.assign(layer,{color:'#7390ff'});
   Object.assign(layer,action.props||{});old.push(layer);selectedId=layer.id;count++;
  }else if(['front','back'].includes(action.op)&&known.has(action.id)){const idx=old.findIndex(x=>x.id===action.id);const [item]=old.splice(idx,1);old.splice(action.op==='front'?old.length:0,0,item);count++;}
 }
 if(count){markChange({record:false});renderBoard();}else history.pop();return count;
}
async function askAIEdit55(instruction){
 if(!hasAI()||!currentProject)return false;
 if(!/(edita|cambia|modifica|agrega|pon|mueve|quita|ajusta|centra|reemplaza|crea|haz|alinea)/i.test(instruction))return false;
 try{const response=await apiRequest('/api/ai/edit-plan',{method:'POST',body:JSON.stringify({project_id:currentProject.id,instruction,layers:currentDesign.layers})});
  if(!response.actions?.length)return false;
  const description=response.summary||`La IA propone ${response.actions.length} operaciones sobre el diseño.`;
  if(!await askConfirm('Aplicar cambios de IA',description+'\n\nPodrás deshacerlos.'))return true;
  const count=applyPlan55(response.actions);bot(`Apliqué ${count} cambios editables. Puedes deshacerlos en el editor.`);return true;
 }catch(e){console.warn('No hay plan de IA:',e.message);return false;}
}
function quickAIEdit55(text){
 // Reglas deterministas y reversibles; no implican que un modelo generativo esté instalado.
 if(!currentDesign)return false;
 const l=selected(),str=String(text).toLowerCase();if(!l)return false;
 let matched=false,updates={};
 const opacity=str.match(/(?:opacidad|transparencia)\s*(?:a|al|en|de)?\s*(\d{1,3})\s*%?/);
 if(opacity){updates.opacity=Math.min(100,Number(opacity[1]))/100;matched=true;}
 const font=str.match(/(?:tamaño|tamano)(?:\s+de\s+letra)?\s*(?:a|al|de)?\s*(\d{1,3})/);
 if(font&&l.type==='text'){updates.fontSize=Math.min(300,Number(font[1]));matched=true;}
 if(/centr(a|ar|ado)/.test(str)){updates.x=(100-l.w)/2;matched=true;}
 if(/voltea.*horizontal/.test(str)&&l.type==='image'){updates.flipH=!l.flipH;matched=true;}
 if(/voltea.*vertical/.test(str)&&l.type==='image'){updates.flipV=!l.flipV;matched=true;}
 if(/pon.*(delante|al frente)/.test(str)){frontBack55('front');matched=true;}
 if(/pon.*(detr[aá]s|al fondo)/.test(str)){frontBack55('back');matched=true;}
 if(Object.keys(updates).length)modifySelected(l=>Object.assign(l,updates));
 return matched;
}
async function init(){try{await ensureAuth();setupAccountControls();setupProFeatures();setupLibrary51();setupLibrary55();setupEditor55();if(window.WSA_WEB_MODE){document.querySelector('.project-storage55')?.classList.add('hidden');}db=await openDatabase();await refresh();await migrateLocalStorage();try{if(navigator.storage?.persist)await navigator.storage.persist();}catch{}status(window.WSA_WEB_MODE?'Guardado en nube':'Guardado en servidor','good');$$('.nav').forEach(b=>b.onclick=()=>navigate(b.dataset.page));$('#newProject').onclick=async()=>{const name=await newProjectDialog();if(!name?.trim())return;if(projects.some(x=>x.name.toLowerCase()===name.toLowerCase())){toast('Ya existe un proyecto con ese nombre.');return;}const p=freshProject(name.trim());await queueDb(()=>put(db,'projects',p));projects.push(p);renderProjects();renderStorage55();};$('#newDesign').onclick=async()=>{if(!await askConfirm('Nuevo diseño','El diseño actual se guardará automáticamente antes de crear un lienzo nuevo.'))return;await saveCurrent();currentDesign=defaultDesign(currentProject.id);selectedId=currentDesign.layers[0].id;history=[];future=[];dirty=true;await saveCurrent();renderStudio();};$('#openDesignList').onclick=()=>navigate('designs');$('#saveDesign').onclick=async()=>{const name=await askText('Guardar diseño',currentDesign.name,'Nombre del diseño');if(name?.trim())currentDesign.name=name.trim();dirty=true;await saveCurrent();$('#designNameLabel').textContent=currentDesign.name;toast('Diseño guardado.');};$('#canvasRatio').onchange=e=>{history.push(snapshot());currentDesign.ratio=e.target.value;markChange({record:false});renderBoard();};$('#bgColor').onchange=e=>{history.push(snapshot());currentDesign.bg=e.target.value;markChange({record:false});renderBoard();};$('#addText').onclick=()=>addLayer('text');$('#addShape').onclick=()=>addLayer('shape');$('#undoEdit').onclick=undo;$('#redoEdit').onclick=redo;$('#exportTop56').onclick=()=>openExportPanel56(currentDesign,opts=>exportImage(opts.format,opts));$('#sendChat').onclick=sendChat;$('#chatInput').onkeydown=e=>{if(e.key==='Enter')sendChat()};$('#textValue').onchange=e=>modifySelected(l=>l.text=e.target.value);updateProperty('#fontSize',l=>l.fontSize=Math.max(8,Math.min(180,+$('#fontSize').value)));updateProperty('#textColor',l=>l.color=$('#textColor').value);updateProperty('#fontFamily',l=>l.font=$('#fontFamily').value);updateProperty('#shapeColor',l=>l.color=$('#shapeColor').value);updateProperty('#widthRange',l=>l.w=+$('#widthRange').value);updateProperty('#rotationRange',l=>l.rotation=+$('#rotationRange').value);updateProperty('#opacity',l=>l.opacity=+$('#opacity').value/100);updateProperty('#shadow',l=>l.shadow=$('#shadow').value);$('#layerUp').onclick=()=>{const i=currentDesign.layers.findIndex(x=>x.id===selectedId);if(i<0||i>=currentDesign.layers.length-1)return;history.push(snapshot());[currentDesign.layers[i],currentDesign.layers[i+1]]=[currentDesign.layers[i+1],currentDesign.layers[i]];markChange({record:false});renderBoard();};$('#layerDown').onclick=()=>{const i=currentDesign.layers.findIndex(x=>x.id===selectedId);if(i<=0)return;history.push(snapshot());[currentDesign.layers[i],currentDesign.layers[i-1]]=[currentDesign.layers[i-1],currentDesign.layers[i]];markChange({record:false});renderBoard();};$('#duplicateLayer').onclick=()=>{const s=selected();if(!s)return;history.push(snapshot());const copy=structuredClone(s);copy.id=uid();copy.x=Math.min(90,copy.x+5);copy.y=Math.min(90,copy.y+5);currentDesign.layers.push(copy);selectedId=copy.id;markChange({record:false});renderBoard();};$('#uploadAssets').onclick=()=>$('#fileInput').click();
$('#uploadFolders').onclick=()=>$('#folderInput').click();
$('#uploadNewCategory').onclick=()=>{$('#categoryManager').classList.remove('hidden');$('#categoryName').focus();$('#categoryManager').scrollIntoView({behavior:'smooth',block:'nearest'});};
$('#fileInput').onchange=e=>{stageFiles([...e.target.files],'files');e.target.value='';};
$('#folderInput').onchange=e=>{stageFiles([...e.target.files],'folder');e.target.value='';};
$('#confirmUpload').onclick=uploadStagedFiles;
$('#cancelUpload').onclick=()=>{discardStagedUpload();uploadResult('Carga cancelada: no se modificaron archivos.');};
$('#stopUpload').onclick=()=>{cancelUploadRequested=true;$('#stopUpload').disabled=true;$('#uploadProgressLabel').textContent='Deteniendo después del archivo actual…';};$('#libraryProject').onchange=renderLibrary;$('#assetSearch').oninput=renderLibrary;$('#assetFilter').onchange=renderLibrary;$('#assetFolderFilter').onchange=renderLibrary;$('#designProjectFilter').onchange=renderDesigns;$('#backupTop').onclick=exportBackup;$('#exportBackup').onclick=exportBackup;$('#importBackup').onclick=()=>$('#importInput').click();$('#importInput').onchange=async e=>{if(e.target.files[0])await importBackup(e.target.files[0]);e.target.value='';};window.addEventListener('pagehide',()=>{if(dirty)saveCurrent().catch(()=>{});});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dirty)saveCurrent().catch(()=>{});});window.addEventListener('resize',()=>{if(activePage==='studio')renderBoard();});document.addEventListener('keydown',e=>{if(activePage!=='studio'||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}});await navigate('projects');if(!projects.length)toast('Crea un proyecto para comenzar.');}catch(e){console.error(e);status('Error de almacenamiento','bad');toast('No se pudo iniciar la base de datos: '+e.message)}}
init();
