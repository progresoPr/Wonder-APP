/* 5.6 export sheet: only show formats implemented by the renderer. */
export function openExportPanel56(design,exportFn){
 document.querySelector('.export56-backdrop')?.remove();
 const backdrop=document.createElement('div');backdrop.className='export56-backdrop';
 const panel=document.createElement('form');panel.className='export56-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Exportar diseño');
 const fmt=[['image/png','PNG · calidad sin pérdidas'],['image/jpeg','JPG · fotografías y redes'],['image/webp','WebP · archivos ligeros'],['application/pdf','PDF · página con imagen'],['image/svg+xml','SVG · imagen raster incrustada']];
 const date=new Date(design.created||Date.now()).toLocaleDateString('en-CA');
 panel.innerHTML=`<div class="export56-header"><h2>Descargar diseño</h2><button type="button" id="expClose56" class="secondary" aria-label="Cerrar">✕</button></div>
 <p class="export56-note">Personaliza la calidad, el formato y la resolución. El diseño editable se conserva por separado con sus capas.</p>
 <label>Tipo de archivo <select id="expFormat56"></select></label>
 <label>Nombre de archivo <input id="expName56" maxlength="140" required></label>
 <label>Tamaño <input id="expScale56" type="range" min="1" max="4" step="1" value="1"><span id="expSize56" class="export56-note"></span></label>
 <label id="expQualityWrap56">Calidad de imagen <select id="expQuality56"><option value="0.72">Comprimida</option><option value="0.9" selected>Alta</option><option value="0.98">Máxima</option></select></label>
 <label id="expAlphaWrap56" style="display:flex;flex-direction:row;align-items:center"><input type="checkbox" id="expAlpha56" style="width:17px;height:17px"> Fondo transparente</label>
 <label style="display:flex;flex-direction:row;align-items:center"><input id="expRemember56" type="checkbox" style="width:17px;height:17px" checked> Recordar preferencias</label>
 <div class="export56-help" id="expHint56">PNG conserva la transparencia y detalles nítidos.</div>
 <p id="expError56" role="alert" class="wonder-modal-error"></p>
 <button type="submit" id="expGo56" class="primary">↓ Descargar</button>`;
 backdrop.append(panel);document.body.append(backdrop);
 const $=s=>panel.querySelector(s);let saved={};try{saved=JSON.parse(localStorage.getItem('wonder_export_56')||'{}')}catch{}
 for(const [value,label] of fmt)$('#expFormat56').add(new Option(label,value));
 $('#expFormat56').value=fmt.some(x=>x[0]===saved.format)?saved.format:'image/png';
 $('#expName56').value=`${date} - ${design.name||'Diseño nuevo'}`;
 $('#expScale56').value=String(Math.min(4,Math.max(1,+saved.scale||1)));$('#expQuality56').value=saved.quality||'0.9';$('#expAlpha56').checked=!!saved.transparent;
 const close=()=>{backdrop.remove();document.removeEventListener('keydown',onKey)};
 function onKey(e){if(e.key==='Escape'){e.preventDefault();close()}}
 $('#expClose56').onclick=close;backdrop.addEventListener('pointerdown',e=>{if(e.target===backdrop)close()});document.addEventListener('keydown',onKey);
 const update=()=>{
  const ratio=design.ratio?.split('/').map(Number)||[1,1];let w=1080,h=Math.round(1080*ratio[1]/ratio[0]);if(ratio[0]===16){w=1920;h=1080}if(ratio[0]===9){w=1080;h=1920}
  const scale=+$('#expScale56').value;$('#expSize56').textContent=`${(w*scale).toLocaleString('es-MX')} × ${(h*scale).toLocaleString('es-MX')} píxeles · ${scale}×`;
  const f=$('#expFormat56').value;$('#expQualityWrap56').style.display=['image/jpeg','image/webp','application/pdf'].includes(f)?'grid':'none';
  $('#expAlphaWrap56').style.display=['image/png','image/webp'].includes(f)?'flex':'none';
  $('#expHint56').textContent=f==='application/pdf'?'El PDF incluye la página como imagen de alta resolución; los textos no se convierten a objetos PDF editables.':f==='image/svg+xml'?'El SVG contiene una imagen incrustada: no vectoriza automáticamente fotografías ni convierte el diseño a objetos SVG independientes.':f==='image/jpeg'?'JPG no admite transparencia; el fondo se integra en el resultado.':f==='image/webp'?'WebP permite compresión con calidad configurable y, cuando el navegador lo admite, transparencia.':'PNG conserva bordes y textos nítidos y admite transparencia.';
 };
 $('#expFormat56').onchange=update;$('#expScale56').oninput=update;update();
 panel.onsubmit=async e=>{e.preventDefault();$('#expGo56').disabled=true;$('#expGo56').textContent='Exportando…';$('#expError56').textContent='';
  try{const opts={format:$('#expFormat56').value,scale:+$('#expScale56').value,quality:+$('#expQuality56').value,transparent:$('#expAlpha56').checked,name:$('#expName56').value.trim()};
   if($('#expRemember56').checked)try{localStorage.setItem('wonder_export_56',JSON.stringify(opts))}catch(e){console.warn('Preferencias de exportación no persistidas:',e.message)};
   await exportFn(opts);close();
  }catch(err){$('#expError56').textContent=err.message||'No se pudo exportar';$('#expGo56').disabled=false;$('#expGo56').textContent='↓ Descargar';}
 };
 $('#expFormat56').focus();
}
export async function jpegToPdf56(blob,w,h){
 const jpeg=new Uint8Array(await blob.arrayBuffer()),enc=new TextEncoder(),chunks=[];let off=0;
 const push=b=>{let bytes=typeof b==='string'?enc.encode(b):b;chunks.push(bytes);off+=bytes.length};
 const offsets=[0];const obj=(id,content)=>{offsets[id]=off;push(`${id} 0 obj\n${content}\nendobj\n`)};
 push('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 // Limit large PDF page dimensions while keeping the ratio.
 const pw=w>1440?1440:w,ph=Math.round(h*pw/w);
 obj(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
 offsets[4]=off;push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);push(jpeg);push('\nendstream\nendobj\n');
 const stream=`q\n${pw} 0 0 ${ph} 0 0 cm\n/Im0 Do\nQ\n`;obj(5,`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`);
 const xoff=off;push('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)push(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
 push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xoff}\n%%EOF`);
 return new Blob(chunks,{type:'application/pdf'});
}
