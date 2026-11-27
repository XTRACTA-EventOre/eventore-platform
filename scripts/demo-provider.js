import {readDemoCode,sandboxEnabled} from '../src/services/identity/demoMailbox.js';
if(!sandboxEnabled())throw Error('Habilita EVENTORE_DEMO_PROVIDERS solo en tu entorno de demostración');
const [action,id,value]=process.argv.slice(2);
if(action==='mail' && id && ['login','reset'].includes(value)){
  console.log(await readDemoCode(id,value));
}else if(action==='payment' && /^[0-9a-f-]{36}$/i.test(id) && ['Paid','Rejected'].includes(value)){
  if(!process.env.BILLING_PROVIDER_SECRET)throw Error('Configura el secreto del proveedor de prueba');
  const response=await fetch('http://127.0.0.1:3001/api/v1/auth/billing/confirmation',{method:'POST',
    headers:{authorization:'Bearer '+process.env.BILLING_PROVIDER_SECRET,'content-type':'application/json'},
    body:JSON.stringify({id,status:value,amountMinor:4900,currency:'PEN',reference:'demo-'+id})});
  if(!response.ok)throw Error('Confirmación rechazada ('+response.status+')');
  console.log('Pago de demostración procesado:',value);
}else throw Error('Uso: mail CORREO login|reset o payment ORDEN Paid|Rejected');
