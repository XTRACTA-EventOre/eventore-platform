import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';

const folder=join(tmpdir(),'eventore-demo-mail');
function pathFor(email,purpose){
  return join(folder,createHash('sha256').update(email.trim().toLowerCase()+'|'+purpose).digest('hex'));
}
export function sandboxEnabled(){
  return process.env.EVENTORE_DEMO_PROVIDERS==='true' && process.env.NODE_ENV!=='production';
}
export async function deliverDemoCode({email,purpose,code}){
  if(!sandboxEnabled())throw Error('Buzón de demostración deshabilitado');
  await mkdir(folder,{recursive:true,mode:0o700});
  await writeFile(pathFor(email,purpose),JSON.stringify({code,expires:Date.now()+600000}),{mode:0o600});
}
export async function readDemoCode(email,purpose){
  if(!sandboxEnabled())throw Error('Buzón de demostración deshabilitado');
  const item=JSON.parse(await readFile(pathFor(email,purpose),'utf8'));
  if(item.expires<=Date.now())throw Error('Código vencido');
  return item.code;
}
