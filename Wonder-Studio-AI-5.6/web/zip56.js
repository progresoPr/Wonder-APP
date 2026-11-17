/* ZIP STORED archive creator, no external dependency, for exporting web folders. */
const encoder=new TextEncoder();
const table=(()=>{const a=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;a[i]=c>>>0;}return a})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=table[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function u16(v){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,v,true);return b}
function u32(v){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v>>>0,true);return b}
function parts(...items){return new Blob(items)}
export async function createZip56(entries){
 if(entries.length>2000)throw Error('Para carpetas de más de 2000 archivos usa el respaldo completo.');
 const chunks=[],central=[];let offset=0;
 const when=new Date(),dosTime=(when.getHours()<<11)|(when.getMinutes()<<5)|(when.getSeconds()>>1),dosDate=((when.getFullYear()-1980)<<9)|((when.getMonth()+1)<<5)|when.getDate();
 for(const entry of entries){
  const path=String(entry.name||'archivo').replace(/\\/g,'/').replace(/^\/+|(^|\/)\.\.(?=\/|$)/g,'').replace(/[:*?"<>|]/g,'_').slice(0,450);
  const name=encoder.encode(path),bytes=new Uint8Array(await entry.blob.arrayBuffer()),size=bytes.length,crc=crc32(bytes);
  if(size>0xffffffff||offset>0xffffffff)throw Error('Archivo mayor al límite ZIP clásico (4 GB).');
  const local=parts(u32(0x04034b50),u16(20),u16(2048),u16(0),u16(dosTime),u16(dosDate),u32(crc),u32(size),u32(size),u16(name.length),u16(0),name);
  chunks.push(local,bytes);
  central.push(parts(u32(0x02014b50),u16(20),u16(20),u16(2048),u16(0),u16(dosTime),u16(dosDate),u32(crc),u32(size),u32(size),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name));
  offset+=local.size+size;
 }
 const cd=parts(...central),end=parts(u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(cd.size),u32(offset),u16(0));
 return new Blob([...chunks,cd,end],{type:'application/zip'});
}
