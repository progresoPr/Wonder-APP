/* Wonder Studio AI 5.6 — accessible, asynchronous application dialogs. */
function modal({title,description='',label='',value='',placeholder='',confirm='Guardar',kind='text',danger=false,choices=[]}){
 return new Promise(resolve=>{
  const root=document.createElement('div');root.className='wonder-modal-backdrop';
  const box=document.createElement('section');box.className='wonder-modal';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
  const top=document.createElement('div');top.className='wonder-modal-head';
  const emblem=document.createElement('span');emblem.className='wonder-modal-icon';emblem.textContent=danger?'!':'✦';
  const heading=document.createElement('div');const h=document.createElement('h2');h.textContent=title;heading.append(h);
  if(description){const p=document.createElement('p');p.textContent=description;heading.append(p)}
  top.append(emblem,heading);box.append(top);
  let input;
  if(kind==='text'){
   const lab=document.createElement('label');lab.className='wonder-modal-label';lab.textContent=label||'Nombre';
   input=document.createElement('input');input.value=value;input.placeholder=placeholder;input.maxLength=150;
   lab.append(input);box.append(lab);
   const error=document.createElement('div');error.className='wonder-modal-error';error.setAttribute('role','alert');box.append(error);
   input.addEventListener('input',()=>error.textContent='');
  }
  if(kind==='select'){
   const lab=document.createElement('label');lab.className='wonder-modal-label';lab.textContent=label||'Selecciona una opción';
   input=document.createElement('select');for(const c of choices) input.add(new Option(c.label,c.value));
   box.append(lab);lab.append(input);
  }
  if(kind==='info'){
   const body=document.createElement('div');body.className='wonder-modal-description';body.textContent=value;box.append(body);
  }
  const foot=document.createElement('div');foot.className='wonder-modal-actions';
  let cancel;if(kind!=='info'){
   cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Cancelar';foot.append(cancel);
  }
  const ok=document.createElement('button');ok.type='button';ok.className=danger?'danger wonder-modal-danger':'primary';ok.textContent=confirm;
  foot.append(ok);box.append(foot);root.append(box);document.body.append(root);
  const previous=document.activeElement;
  const finish=v=>{document.removeEventListener('keydown',keys,true);root.remove();if(previous?.isConnected)previous.focus();resolve(v)};
  if(cancel)cancel.onclick=()=>finish(null);
  ok.onclick=()=>{
   if(kind==='text'){
    const next=input.value.trim();if(!next&&!['Descripción','Texto complementario'].includes(label)){box.querySelector('.wonder-modal-error').textContent='Escribe un nombre antes de continuar.';input.focus();return}
    if(/[\\/:*?"<>|]/.test(next)){box.querySelector('.wonder-modal-error').textContent='No utilices caracteres \\ / : * ? " < > | en el nombre.';input.focus();return}
    finish(next);
   }else if(kind==='select')finish(input.value);else finish(true);
  };
  root.addEventListener('pointerdown',e=>{if(e.target===root)finish(null)});
  const keys=e=>{if(!root.isConnected)return;if(e.key==='Escape'){e.preventDefault();finish(null)}else if(e.key==='Enter' && (kind!=='info'||document.activeElement!==cancel)){e.preventDefault();ok.click()}else if(e.key==='Tab'){
   const nodes=[...box.querySelectorAll('input,select,button')].filter(x=>!x.disabled);
   const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }};document.addEventListener('keydown',keys,true);setTimeout(()=>{(input||ok).focus();if(kind==='text')input.select()},0);
 });
}
export function askText(title,value='',label='Nombre'){return modal({title,label,value,confirm:'Guardar cambios'})}
export function newProjectDialog(value=''){return modal({title:value?'Renombrar proyecto':'Nuevo proyecto',description:'Crea un espacio para tus diseños, archivos y recursos.',label:'Nombre del proyecto',value,placeholder:'Ej. Pitayo Carne Seca',confirm:value?'Guardar cambios':'Crear proyecto'})}
export async function askConfirm(title,description='',danger=false){return (await modal({title,description,kind:'confirm',danger,confirm:danger?'Sí, continuar':'Confirmar'}))===true}
export function showInfo(title,value){return modal({title,value,kind:'info',confirm:'Cerrar'})}
export function askChoice(title,choices){return modal({title,kind:'select',choices,confirm:'Seleccionar'})}
