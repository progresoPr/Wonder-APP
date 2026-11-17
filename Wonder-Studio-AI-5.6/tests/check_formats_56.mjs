import fs from 'node:fs';
import {jpegToPdf56} from '../export-ui56.js';
import {createZip56} from '../web/zip56.js';
const jpeg=new Blob([fs.readFileSync('/tmp/wsa56-sample.jpg')],{type:'image/jpeg'});
const pdf=await jpegToPdf56(jpeg,12,18);
fs.writeFileSync('/tmp/wsa56-output.pdf',Buffer.from(await pdf.arrayBuffer()));
const archive=await createZip56([{name:'Pitayo/Logo.png',blob:new Blob([Buffer.from([1,2,3,4,5])])},{name:'Diseños/2026 - Test.txt',blob:new Blob(['Hola Wonder'])}]);
fs.writeFileSync('/tmp/wsa56-output.zip',Buffer.from(await archive.arrayBuffer()));
console.log('PDF bytes',pdf.size,'ZIP bytes',archive.size);
