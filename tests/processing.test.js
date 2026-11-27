import {describe,test,expect,beforeAll,afterAll,jest} from '@jest/globals';
import {randomUUID} from 'node:crypto';
import {serviceHarness} from './support/serviceHarness.js';
jest.setTimeout(60000);
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite('US27–US32 Processing through independent HTTP services',()=>{
  let h;beforeAll(async()=>{h=await serviceHarness();});afterAll(async()=>{await h?.close();});
  const planOutput=(weight,kind='Output')=>({weight,weightUnit:'kg',kind,destination:'Línea de planta'});
  test('analysis validates range and correction preserves original assay with a reason',async()=>{
    const received=await h.receivedLot();const id=received.lotId;await h.processing(id,'start');
    const initial=await h.processing(id,'assays',{purity:'98.5',evidenceRef:'LAB-001',correctionOf:null,correctionReason:null});
    const invalid={operationId:randomUUID(),expectedVersion:initial.version,purity:'101',evidenceRef:'LAB-ERROR',correctionOf:initial.assayId,correctionReason:'Corrección'};
    await h.api('plant','post',`/api/v1/processing/lots/${id}/assays`,invalid,400);
    const corrected=await h.processing(id,'assays',{purity:'99',evidenceRef:'LAB-002',correctionOf:initial.assayId,correctionReason:'Ensayo de contraste'});
    expect(corrected.correctionOf).toBe(initial.assayId);
    const read=await h.api('plant','get',`/api/v1/processing/lots/${id}`);
    expect(read.snapshot.facts.filter(fact=>fact.action==='AssayRecorded')).toHaveLength(2);
    expect(read.snapshot.latestAssay.purity).toBe('99');
    await h.api('foreign','get',`/api/v1/processing/lots/${id}`,undefined,404);
    await h.api('carrier','post',`/api/v1/processing/lots/${id}/complete`,{operationId:randomUUID(),expectedVersion:corrected.version,reviewNote:'No autorizado'},403);
  });
  test('split creates three new identities with complete mass accounting and blocks double consumption',async()=>{
    const root=await h.receivedLot();await h.processing(root.lotId,'start');
    const version=(await h.current(root.lotId)).version;
    const body={operationId:randomUUID(),expectedVersion:version,inputs:[{lotId:root.lotId,expectedVersion:version}],plan:{mode:'Split',outputs:[planOutput('40'),planOutput('35'),planOutput('25','Remainder')]}};
    const split=await h.api('plant','post',`/api/v1/processing/lots/${root.lotId}/transformations`,body);
    expect(split.children).toHaveLength(3);expect(new Set(split.children.map(child=>child.lotId)).size).toBe(3);
    expect((await h.current(root.lotId)).status).toBe('Consumed');
    expect(await h.api('plant','post',`/api/v1/processing/lots/${root.lotId}/transformations`,body)).toEqual(split);
    await h.api('plant','post',`/api/v1/processing/lots/${root.lotId}/transformations`,{...body,operationId:randomUUID(),expectedVersion:split.version,inputs:[{lotId:root.lotId,expectedVersion:split.version}]},409);
    const [[{n}]]=await h.runtimes.traceability.pool.execute('SELECT COUNT(*) AS n FROM lot_lineage WHERE tenant_id=? AND parent_lot_id=?',[h.tenantId,root.lotId]);expect(Number(n)).toBe(3);
  });
  test('split rejects both excess and unexplained missing output mass',async()=>{
    const root=await h.receivedLot();await h.processing(root.lotId,'start');const version=(await h.current(root.lotId)).version;
    for(const weights of [['60','50'],['40','40']])await h.api('plant','post',`/api/v1/processing/lots/${root.lotId}/transformations`,{operationId:randomUUID(),expectedVersion:version,inputs:[{lotId:root.lotId,expectedVersion:version}],plan:{mode:'Split',outputs:weights.map(weight=>planOutput(weight))}},409);
    expect((await h.current(root.lotId)).status).toBe('Processing');
  });
  test('merge preserves both parents, rejects different origin and detects a cyclic genealogy',async()=>{
    const first=await h.receivedLot({weight:'40'}),second=await h.receivedLot({weight:'60'}),foreign=await h.receivedLot({weight:'60',reference:'OTHER-SOURCE'});
    for(const lot of[first,second,foreign])await h.processing(lot.lotId,'start');
    const refs=await Promise.all([first,second].map(async lot=>({lotId:lot.lotId,expectedVersion:(await h.current(lot.lotId)).version})));
    const wrong={lotId:foreign.lotId,expectedVersion:(await h.current(foreign.lotId)).version};
    await h.api('plant','post',`/api/v1/processing/lots/${first.lotId}/transformations`,{operationId:randomUUID(),expectedVersion:refs[0].expectedVersion,inputs:[refs[0],wrong],plan:{mode:'Merge',outputs:[planOutput('100')]}},409);
    const merged=await h.processing(first.lotId,'transformations',{inputs:refs,plan:{mode:'Merge',outputs:[planOutput('100')]}});
    expect(merged.children).toHaveLength(1);
    const child=merged.children[0].lotId;
    await h.runtimes.traceability.pool.execute('INSERT INTO lot_lineage(tenant_id,parent_lot_id,child_lot_id,operation_id) VALUES(?,?,?,?)',[h.tenantId,child,first.lotId,randomUUID()]);
    const corrupt=await h.api('plant','get',`/api/v1/processing/lots/${child}`);
    expect(corrupt.snapshot.status).toBe('Processing');
    const response=await fetch(`${h.urls.traceability}/internal/lots/${child}/genealogy`,{headers:{cookie:h.cookies.plant,'x-internal-secret':h.internalSecret}});
    expect(response.status).toBe(409);expect((await response.json()).error.code).toBe('CYCLIC_GENEALOGY');
  });
  test('purification preserves gross weight, distinguishes impurities and blocks mass increase',async()=>{
    const lot=await h.receivedLot();await h.processing(lot.lotId,'start');const version=(await h.current(lot.lotId)).version;
    await h.api('plant','post',`/api/v1/processing/lots/${lot.lotId}/purification`,{operationId:randomUUID(),expectedVersion:version,netWeight:'101',weightUnit:'kg',removedKind:'Impurities',reason:'Inválido',evidenceRef:'PROC-0'},409);
    const result=await h.processing(lot.lotId,'purification',{netWeight:'90',weightUnit:'kg',removedKind:'Impurities',reason:'Separación de impurezas documentada',evidenceRef:'PROC-1'});
    expect(result).toMatchObject({grossWeight:'100',netWeight:'90',removedWeight:'10',removedKind:'Impurities',critical:false});
    expect((await h.current(lot.lotId)).weight).toBe('90');
  });
  test('technical loss above five percent blocks completion until reviewed and all stages are present',async()=>{
    const lot=await h.receivedLot();await h.processing(lot.lotId,'start');
    const loss=await h.processing(lot.lotId,'losses',{lossWeight:'6',weightUnit:'kg',reason:'Merma técnica documentada'});
    expect(loss).toMatchObject({critical:true,lossPercentage:'6',netWeight:'94'});
    await h.api('plant','post',`/api/v1/processing/lots/${lot.lotId}/complete`,{operationId:randomUUID(),expectedVersion:loss.version,reviewNote:'Cierre'},409);
    await h.api('plant','post',`/api/v1/shipments/lots/${lot.lotId}/restriction-review`,{operationId:randomUUID(),expectedVersion:loss.version,restrictionId:loss.restrictionId,decision:'Release',reason:'Balance revisado y aceptado'});
    const analysis=await h.processing(lot.lotId,'assays',{purity:'95',evidenceRef:'LAB-FINAL',correctionOf:null,correctionReason:null});
    const completed=await h.processing(lot.lotId,'complete',{reviewNote:'Análisis y balance completos'},analysis.version);
    expect(completed.status).toBe('Processed');
    const [[projection]]=await h.runtimes.processing.pool.execute('SELECT status FROM processing_lots WHERE tenant_id=? AND lot_id=?',[h.tenantId,lot.lotId]);expect(projection.status).toBe('Processed');
    const [tables]=await h.runtimes.processing.pool.query('SHOW TABLES');expect(tables.flatMap(row=>Object.values(row))).not.toContain('mineral_lots');
  });
});
