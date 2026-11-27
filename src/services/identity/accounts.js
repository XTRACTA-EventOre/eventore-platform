import { Router } from 'express';
import { createHash,randomBytes,randomInt,randomUUID,timingSafeEqual } from 'node:crypto';
import { hashPassword } from '../../shared/infrastructure/http/sessionAuth.js';
import { transaction } from '../../shared/infrastructure/persistence/transaction.js';
import { OperationError } from '../../shared/application/OperationError.js';
import { apiError,text,uuid } from '../../shared/infrastructure/http/operationHttp.js';

const hash = value=>createHash('sha256').update(value).digest('hex');
const fail = (status,code,message)=>new OperationError(status,code,message);
function emailAddress(value) {
  const email=text(value,'Correo',254).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400,'INVALID_EMAIL','Revisa el correo');
  return email;
}
export async function deliverCode({email,purpose,code}) {
  const url=process.env.ACCOUNT_MAIL_URL, secret=process.env.ACCOUNT_MAIL_SECRET;
  if(!url||!secret||new URL(url).protocol!=='https:') throw Error('Configura el servicio de correo');
  const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
    headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({email,purpose,code,validMinutes:10})});
  if(!response.ok) throw Error('Correo sin confirmar');
}
export async function challenge(db,user,purpose,code,send=deliverCode) {
  const [[previous]]=await db.execute('SELECT *,sent_at>UTC_TIMESTAMP(3)-INTERVAL 60 SECOND AS recent FROM account_challenges WHERE user_id=? AND purpose=? FOR UPDATE',[user.id,purpose]);
  if(code!==undefined) {
    if(!previous || previous.attempts>=5 || new Date(previous.expires_at)<=new Date()) return false;
    const correct=typeof code==='string' && code.length<=128 && timingSafeEqual(Buffer.from(previous.token_hash,'hex'),Buffer.from(hash(user.id+purpose+code),'hex'));
    if(correct) await db.execute('DELETE FROM account_challenges WHERE user_id=? AND purpose=?',[user.id,purpose]);
    else await db.execute('UPDATE account_challenges SET attempts=attempts+1 WHERE user_id=? AND purpose=?',[user.id,purpose]);
    return correct;
  }
  if(previous?.recent) return false;
  const token=purpose==='reset'?randomBytes(24).toString('hex'):String(randomInt(100000,1000000));
  await db.execute('REPLACE INTO account_challenges(user_id,purpose,token_hash,expires_at,sent_at) VALUES(?,?,?,UTC_TIMESTAMP(3)+INTERVAL 10 MINUTE,UTC_TIMESTAMP(3))',[user.id,purpose,hash(user.id+purpose+token)]);
  await send({email:user.email,purpose,code:token});
  return false;
}
export function accountsRouter(pool,send) {
  const router=Router(), handle=fn=>async(req,res)=>{
    res.set('Cache-Control','no-store');
    try { res.json(await fn(req.body??{})); } catch(err){apiError(res,err);}
  };
  router.post('/register',handle(async body=>{
    const email=emailAddress(body.email), companyId=text(body.companyId,'RUC',11);
    if(!/^\d{11}$/.test(companyId)) throw fail(400,'INVALID_COMPANY','Ingresa los 11 dígitos del RUC');
    if(typeof body.password!=='string'||body.password.length<12||body.password.length>128) throw fail(400,'INVALID_PASSWORD','Usa entre 12 y 128 caracteres');
    const name=text(body.companyName,'Razón social',160), evidence=text(body.evidence,'Referencia de evidencia',500),id=randomUUID();
    try {
      await pool.execute('INSERT INTO corporate_requests(id,company_id,company_name,email,password_hash,evidence) VALUES(?,?,?,?,?,?)',[id,companyId,name,email,await hashPassword(body.password),evidence]);
    } catch(error){
      if(error.code==='ER_DUP_ENTRY') throw fail(409,'ALREADY_REGISTERED','Este RUC ya tiene una solicitud. Consulta al responsable de validación');
      throw error;
    }
    return {requestId:id,status:'Pending'};
  }));
  router.post('/registration-status',handle(async body=>{
    const [[entry]]=await pool.execute('SELECT status FROM corporate_requests WHERE id=? AND email=?',[uuid(body.requestId),emailAddress(body.email)]);
    if(!entry)throw fail(404,'NOT_FOUND','Solicitud no disponible');
    return {status:entry.status};
  }));
  router.post('/recovery',handle(async body=>{
    const email=emailAddress(body.email);
    if(!send && (!process.env.ACCOUNT_MAIL_URL||!process.env.ACCOUNT_MAIL_SECRET)) throw Error('Correo no disponible');
    await transaction(pool,async db=>{
      const [[user]]=await db.execute('SELECT id,email FROM app_users WHERE email=? AND active=true FOR UPDATE',[email]);
      if(user) await challenge(db,user,'reset',undefined,send);
    });
    return {message:'Si el correo está registrado, recibirás un código de recuperación.'};
  }));
  router.post('/reset',handle(async body=>{
    const email=emailAddress(body.email);
    if(typeof body.code!=='string'||!body.code) throw fail(400,'INVALID_CODE','Ingresa el código recibido');
    if(typeof body.password!=='string'||body.password.length<12||body.password.length>128) throw fail(400,'INVALID_PASSWORD','Usa entre 12 y 128 caracteres');
    const ok=await transaction(pool,async db=>{
      const [[user]]=await db.execute('SELECT id,email FROM app_users WHERE email=? AND active=true FOR UPDATE',[email]);
      if(!user||!await challenge(db,user,'reset',body.code)) return false;
      await db.execute('UPDATE app_users SET password_hash=?,failed_attempts=0,locked_until=NULL WHERE id=?',[await hashPassword(body.password),user.id]);
      await db.execute('DELETE FROM app_sessions WHERE user_id=?',[user.id]);
      await db.execute('DELETE FROM account_challenges WHERE user_id=?',[user.id]);
      return true;
    });
    if(!ok) throw fail(400,'INVALID_CODE','Código vencido o inválido. Solicita otro.');
    return {message:'Contraseña actualizada'};
  }));
  return router;
}
