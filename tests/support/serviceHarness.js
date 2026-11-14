import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { makeMySqlRuntime } from '../sprint1/breithner/mysqlFixture.js';
import { hashPassword } from '../../src/shared/infrastructure/http/sessionAuth.js';
import { createIdentityApp } from '../../src/services/identity/app.js';
import { createTraceabilityApp } from '../../src/services/traceability/app.js';
import { createLogisticsApp } from '../../src/services/logistics/app.js';
import { createProcessingApp } from '../../src/services/processing/app.js';
import { createGatewayApp } from '../../src/services/gateway/app.js';
export async function serviceHarness({includeProcessing=true}={}){
  const runtimes={},servers=[],urls={},cookies={},users={},tenantId=randomUUID(),foreignTenantId=randomUUID();
  const password='Acceptance-test-password',internalSecret='acceptance-internal-secret';
  let gateway;
  async function close(){await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));await Promise.all(Object.values(runtimes).map(runtime=>runtime.close()));}
  async function start(name,app){const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});servers.push(server);urls[name]=`http://127.0.0.1:${server.address().port}`;}
  async function api(actor,method,path,body,status=200){let req=request(gateway)[method](path).set('Cookie',cookies[actor]);if(body!==undefined)req=req.send(body);const response=await req;if(response.status!==status)throw new Error(`${actor} ${method} ${path}: expected ${status}, got ${response.status} ${JSON.stringify(response.body)}`);return response.body;}
  try{
    for(const service of ['identity','traceability','logistics',...(includeProcessing?['processing']:[])])runtimes[service]=await makeMySqlRuntime({service});
    const hash=await hashPassword(password);
    for(const[name,role]of [['admin','Administrator'],['supervisor','Supervisor'],['carrier','Transporter'],['plant','PlantOperator'],['jeweler','Jeweler'],['certifier','Certifier'],['foreign','Administrator']]){
      users[name]=randomUUID();await runtimes.identity.pool.execute('INSERT INTO app_users(id,tenant_id,email,password_hash) VALUES(?,?,?,?)',[users[name],name==='foreign'?foreignTenantId:tenantId,`${name}@example.test`,hash]);
      await runtimes.identity.pool.execute('INSERT INTO app_user_roles(user_id,role_name) VALUES(?,?)',[users[name],role]);
    }
    const options=name=>({pool:runtimes[name].pool,identityUrl:urls.identity,traceabilityUrl:urls.traceability,internalSecret,appBaseUrl:'http://localhost:4173'});
    await start('identity',createIdentityApp(options('identity')));
    await start('traceability',createTraceabilityApp(options('traceability')));
    await start('logistics',createLogisticsApp(options('logistics')));
    if(includeProcessing)await start('processing',createProcessingApp(options('processing')));
    gateway=createGatewayApp({identityUrl:urls.identity,traceabilityUrl:urls.traceability,logisticsUrl:urls.logistics,processingUrl:urls.processing,appBaseUrl:'http://localhost:4173'});
    for(const name of Object.keys(users)){const response=await request(gateway).post('/api/v1/auth/login').send({email:`${name}@example.test`,password});if(response.status!==200)throw new Error(`Cannot sign in ${name}`);cookies[name]=response.headers['set-cookie'][0].split(';')[0];}
    const current=id=>api('plant','get',`/api/v1/lots/${id}`);
    async function receivedLot({weight='100',reference='SOURCE-001',source='Origen documentado'}={}){
      const lot=await api('supervisor','post','/api/v1/lots',{clientEventId:randomUUID(),mineralType:'Gold',weight,weightUnit:'kg',originEvidence:{reference,source}},201);
      const delivery=await api('supervisor','post',`/api/v1/lots/${lot.lotId}/handovers`,{operationId:randomUUID(),expectedVersion:1,recipientUserId:null},201);
      const accepted=await api('carrier','post',`/api/v1/custody/lots/${lot.lotId}/accept`,{operationId:randomUUID(),expectedVersion:delivery.version,handoverId:delivery.handoverId});
      return api('plant','post',`/api/v1/shipments/lots/${lot.lotId}/receipt`,{operationId:randomUUID(),expectedVersion:accepted.version});
    }
    async function processing(id,path,payload={},expectedVersion){const version=expectedVersion??(await current(id)).version;return api('plant','post',`/api/v1/processing/lots/${id}/${path}`,{operationId:randomUUID(),expectedVersion:version,...payload});}
    return {api,receivedLot,processing,current,tenantId,foreignTenantId,users,cookies,runtimes,urls,internalSecret,close,get gateway(){return gateway;}};
  }catch(error){await close();throw error;}
}
