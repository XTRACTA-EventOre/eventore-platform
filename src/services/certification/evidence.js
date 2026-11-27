import { createHash } from 'node:crypto';
export function evaluateEvidence(product,graphs){
  const issues=[];
  if(!product.composition.length)issues.push({code:'EMPTY_COMPOSITION'});
  const claims=[];
  for(const material of product.composition){
    if(!material.lotId||material.category==='External'){issues.push({code:'UNVERIFIED_EXTERNAL_MATERIAL',materialId:material.materialId});continue;}
    const graph=graphs.get(material.lotId);
    if(!graph){issues.push({code:'GENEALOGY_MISSING',lotId:material.lotId});continue;}
    for(const node of graph.nodes){
      if(node.originEvidenceStatus!=='Verified')issues.push({code:'EVIDENCE_NOT_APPROVED',lotId:node.lotId});
      if(node.restrictions.length)issues.push({code:'ACTIVE_RESTRICTION',lotId:node.lotId});
      if(node.lotId===material.lotId&&node.status!=='AtJewelry')issues.push({code:'MATERIAL_NOT_RECEIVED',lotId:node.lotId});
      if(node.lotId===material.lotId&&!node.latestAssay)issues.push({code:'ASSAY_MISSING',lotId:node.lotId});
    }
    claims.push({lotId:material.lotId,nodes:graph.nodes.map(node=>({lotId:node.lotId,version:node.version,evidenceStatus:node.originEvidenceStatus,restrictions:node.restrictions.map(r=>r.id).sort()})).sort((a,b)=>a.lotId.localeCompare(b.lotId)),edges:[...graph.edges].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))});
  }
  const evidenceHash=createHash('sha256').update(JSON.stringify({productId:product.id,version:product.version,composition:product.composition,claims})).digest('hex');
  return {eligible:issues.length===0,issues,evidenceHash};
}
export function publicSummary(product,graphs=new Map()){
  const milestones=[];
  for(const graph of graphs.values())for(const node of graph.nodes)for(const event of [...node.history,...node.facts]){
    if(['CustodyAccepted','PlantReceived','ProcessingStarted','ProcessingCompleted','JewelryReceived','LotsTransformed'].includes(event.action))milestones.push({type:event.action,at:event.occurredAt});
  }
  return {product:{id:product.id,name:product.name,compositionVersion:product.version},materials:product.composition.map(m=>({mineralType:m.mineralType,quantityGrams:m.quantityGrams,evidenceLevel:m.category==='External'?'External':'Declared'})),milestones:[...new Map(milestones.map(m=>[JSON.stringify(m),m])).values()].sort((a,b)=>a.at.localeCompare(b.at))};
}
