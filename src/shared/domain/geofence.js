import {OperationError} from '../application/OperationError.js';
const fail=message=>{throw new OperationError(400,'INVALID_GEOMETRY',message);};
export function point(value){if(!value||!Number.isFinite(value.latitude)||!Number.isFinite(value.longitude)||Math.abs(value.latitude)>90||Math.abs(value.longitude)>180)fail('Indica latitud y longitud válidas');return {latitude:value.latitude,longitude:value.longitude};}
const cross=(a,b,c)=>(b.longitude-a.longitude)*(c.latitude-a.latitude)-(b.latitude-a.latitude)*(c.longitude-a.longitude);
const on=(a,b,c)=>Math.abs(cross(a,b,c))<1e-10&&c.longitude>=Math.min(a.longitude,b.longitude)-1e-10&&c.longitude<=Math.max(a.longitude,b.longitude)+1e-10&&c.latitude>=Math.min(a.latitude,b.latitude)-1e-10&&c.latitude<=Math.max(a.latitude,b.latitude)+1e-10;
export function polygon(values){
 if(!Array.isArray(values)||values.length<3||values.length>100)fail('El polígono requiere entre 3 y 100 vértices');
 const nodes=values.map(point);if(JSON.stringify(nodes[0])===JSON.stringify(nodes.at(-1)))nodes.pop();
 if(nodes.length<3||new Set(nodes.map(n=>JSON.stringify(n))).size!==nodes.length)fail('El polígono contiene vértices repetidos');
 if(Math.max(...nodes.map(n=>n.longitude))-Math.min(...nodes.map(n=>n.longitude))>180)fail('Divide las concesiones que cruzan el antimeridiano antes de registrarlas');
 let area=0;for(let i=0;i<nodes.length;i++){const a=nodes[i],b=nodes[(i+1)%nodes.length];area+=a.longitude*b.latitude-b.longitude*a.latitude;}
 if(Math.abs(area)<1e-12)fail('El polígono debe tener un área positiva');
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  if(j===i+1||(i===0&&j===nodes.length-1))continue;
  const a=nodes[i],b=nodes[(i+1)%nodes.length],c=nodes[j],d=nodes[(j+1)%nodes.length];
  if(on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)||(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0))fail('El polígono no puede cruzarse consigo mismo');
 }return nodes;
}
export function contains(vertices,location){const nodes=polygon(vertices),p=point(location);let inside=false;for(let i=0,j=nodes.length-1;i<nodes.length;j=i++){
 const a=nodes[j],b=nodes[i];if(on(a,b,p))return true;
 if((a.latitude>p.latitude)!==(b.latitude>p.latitude)&&p.longitude<(b.longitude-a.longitude)*(p.latitude-a.latitude)/(b.latitude-a.latitude)+a.longitude)inside=!inside;
 }return inside;}
