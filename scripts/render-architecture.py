from pathlib import Path
import re,json,html,math,textwrap
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/architecture';OUT.mkdir(parents=True,exist_ok=True)
FONT=next((str(p) for p in [Path('C:/Windows/Fonts/arial.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if p.exists()),None)
BOLD=next((str(p) for p in [Path('C:/Windows/Fonts/arialbd.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')] if p.exists()),FONT)
class Figure:
 def __init__(self,title,subtitle,w=1500,h=1000):
  self.w=w;self.h=h;self.img=Image.new('RGB',(w,h),'white');self.draw=ImageDraw.Draw(self.img);self.svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="white"/>'];self.text(38,24,title,38,True);self.text(38,77,subtitle,23,color='#455b56')
 def text(self,x,y,value,size=26,bold=False,color='#152b26'):
  font=ImageFont.truetype(BOLD if bold else FONT,size);self.draw.text((x,y),str(value),font=font,fill=color)
  self.svg.append(f'<text x="{x}" y="{y+size}" font-family="Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{html.escape(str(value))}</text>')
 def wrapped(self,x,y,value,width,size=25,bold=False,color='#152b26',maxlines=10):
  font=ImageFont.truetype(BOLD if bold else FONT,size);line='';lines=[]
  for word in value.split():
   if self.draw.textlength((line+' '+word).strip(),font=font)>width and line:lines.append(line);line=word
   else:line=(line+' '+word).strip()
  if line:lines.append(line)
  if len(lines)>maxlines:raise ValueError('Text overflows: '+value)
  for line in lines:self.text(x,y,line,size,bold,color);y+=size+8
  return y
 def box(self,x,y,w,h,title,body,kind='Container',fill='#eef5f2',size=25):
  self.draw.rounded_rectangle((x,y,x+w,y+h),radius=14,fill=fill,outline='#41665b',width=2);self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{fill}" stroke="#41665b" stroke-width="2"/>')
  self.text(x+16,y+12,'['+kind+']',20,color='#546c63');yy=self.wrapped(x+16,y+42,title,w-32,27,True,maxlines=2)
  yy+=8
  for line in body:
   yy=self.wrapped(x+16,yy,line,w-32,size,maxlines=3)+3
  if yy>y+h+4:raise ValueError('Box overflow '+title+' '+str(yy-y))
 def line(self,a,b,label=None):
  self.draw.line([a,b],fill='#607b71',width=3);self.svg.append(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="#607b71" stroke-width="3"/>');angle=math.atan2(b[1]-a[1],b[0]-a[0]);p=[b,(b[0]-14*math.cos(angle-.45),b[1]-14*math.sin(angle-.45)),(b[0]-14*math.cos(angle+.45),b[1]-14*math.sin(angle+.45))];self.draw.polygon(p,fill='#607b71');self.svg.append('<polygon points="'+' '.join(f'{x},{y}'for x,y in p)+'" fill="#607b71"/>')
  if label:self.text((a[0]+b[0])/2-self.draw.textlength(label,font=ImageFont.truetype(FONT,20))/2,(a[1]+b[1])/2-30,label,20)
 def polyline(self,points):
  self.draw.line(points,fill='#607b71',width=3);self.svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in points)+'" fill="none" stroke="#607b71" stroke-width="3"/>')
 def save(self,name):
  self.text(38,self.h-40,'Fuente: código y contratos de EventOre Platform · revisión de Avance 4',20,color='#53655e');self.img.save(OUT/(name+'.png'));(OUT/(name+'.svg')).write_text(''.join(self.svg)+'</svg>',encoding='utf-8')
f=Figure('C4 contexto del incremento','Usuarios y sistemas en el alcance implementado; ERP y pagos continúan en Sprint 4',h=900)
f.box(500,280,500,260,'EventOre',['Trazabilidad mineral y revisión de evidencia','Operaciones B2B y consulta pública','Frontend + gateway + ocho servicios'],kind='Software System',fill='#ddeee7')
f.box(40,150,360,230,'Personal autorizado',['Origen, transporte, planta','Joyería y revisión de certificados'],kind='Person');f.line((400,265),(500,370),'HTTPS')
f.box(1100,150,350,230,'Comprador',['Consulta de historial y vigencia mediante QR'],kind='Person');f.line((1100,265),(1000,370),'HTTPS')
f.box(40,560,360,230,'Administrador',['Roles, concesiones, dispositivos y revocaciones'],kind='Person');f.line((400,640),(500,480))
f.box(1100,560,350,230,'Adaptador de balanza',['Envía peso y batería con credencial propia','Hardware físico no validado'],kind='External System');f.line((1100,640),(1000,480),'API HTTPS');f.save('c4-context')
f=Figure('C4 contenedores implementados','Cada servicio escribe exclusivamente su base MySQL; las llamadas entre propietarios son HTTP',h=1320)
f.box(40,145,480,150,'Frontend Vue y Vite',['Repositorio eventore; IndexedDB offline'],kind='Container');f.box(770,145,670,150,'API Gateway Node Express',['Repositorio eventore-platform; proxy y CORS; sin SQL'],kind='Container');f.line((520,220),(770,220),'HTTP dev / HTTPS cloud')
services=[('Identity','3001','Sesión, roles y autorización','Ninguna lectura SQL externa'),('Traceability','3002','Lote, evidencia y genealogía','Autoridad de versión y masa'),('Logistics','3003','Custodia, viaje y fotografías','HTTP a Identity / Traceability'),('Processing','3004','Planta y ledger de operaciones','HTTP a Identity / Traceability'),('Jewelry','3005','Stock y composición de joyas','HTTP a Identity / Traceability'),('Certification','3006','Decisión, PDF y vigencia','HTTP a Identity / Trace / Jewelry'),('Devices','3007','Registro, calibración y alertas','HTTP Identity / Trace; Bearer Edge'),('Reporting','3008','Reportes y exportaciones','HTTP Identity / Traceability')]
for row in range(2):
 y=390+row*440
 for col in range(4):
  name,port,purpose,dependency=services[row*4+col];x=35+col*370
  f.box(x,y,350,230,name,[purpose,'Node Express · '+port,dependency],size=23)
  f.box(x,y+265,350,120,name.lower()+' DB',['Usuario y volumen propios'],kind='MySQL 8.4',fill='#f0f0f0',size=22);f.line((x+175,y+230),(x+175,y+265))
 if row==0:f.polyline([(1105,295),(1105,y-30),(210,y-30),(1320,y-30)])
 else:f.polyline([(1105,295),(1105,330),(15,330),(15,y-30),(1320,y-30)])
 for col in range(4):f.line((210+370*col,y-30),(210+370*col,y))
f.save('c4-containers')
f=Figure('C4 componentes y coordinación','Propietario de agregado explícito; ledgers y transacciones locales, sin transacción distribuida',h=1020)
f.box(40,170,420,260,'Servicio de operación',['Autenticación remota y permisos actuales','Ledger local con command/result','Reintento conserva UUID y cuerpo'],kind='Component');f.box(550,170,420,260,'Traceability API',['Control de actor y tenant','Validación de versión','Políticas de custodia y planta'],kind='Component');f.line((460,290),(550,290),'HTTP')
f.box(1050,170,410,260,'Agregado autoritativo',['Bloqueo de lote / entradas','Balance exacto y genealogía','Estado e historial atómicos'],kind='Component');f.line((970,290),(1050,290))
f.box(40,610,420,220,'Base del servicio',['Pending → Accepted / Rejected','Proyección y auditoría local'],kind='Database',fill='#f0f0f0');f.line((250,430),(250,610))
f.box(1050,610,410,220,'Base Traceability',['Lotes, versiones y restricciones','Hechos y relaciones de transformación'],kind='Database',fill='#f0f0f0');f.line((1250,430),(1250,610))
f.box(550,610,420,220,'Recuperación',['Consultar operación confirmada','Completar proyección local','Fallo remoto nunca autoriza'],kind='Component');f.line((760,610),(760,430));f.line((550,720),(460,720));f.save('c4-components')
f=Figure('C4 despliegue AWS propuesto','CloudFormation validado estáticamente; cuenta, presupuesto y ejecución cloud pendientes',h=1140)
f.box(40,160,350,190,'Navegador',['SPA, sesión y consulta QR','HTTPS al dominio CloudFront'],kind='Device');f.box(535,160,420,190,'CloudFront',['Dominio AWS y TLS de viewer','Caché desactivada para evidencia'],kind='AWS managed service');f.line((390,255),(535,255),'HTTPS')
f.box(1070,160,380,190,'Secrets Manager',['Cabecera privada del origen','Lectura por rol de la VM'],kind='AWS managed service')
f.box(235,490,1000,410,'EC2 t3.large y Docker Compose',['Caddy HTTP interno de origen + SPA','Gateway + ocho procesos Node / Express','Ocho MySQL con credenciales y volúmenes separados','EBS gp3 30 GiB cifrado; datos retenidos al retirar VM'],kind='Deployment node',fill='#eef5f2',size=29)
f.line((745,350),(745,490),'HTTP: solo red CloudFront + cabecera privada');f.line((1250,350),(1120,490),'Rol de instancia')
f.box(40,945,640,125,'Operación administrativa',['Session Manager; sin puerto SSH abierto'],kind='AWS managed service',size=24);f.box(760,945,690,125,'Límites de la demostración',['Una VM; sin HA ni TLS extremo a extremo al origen'],kind='Design constraint',fill='#f7f1e7',size=24);f.save('c4-aws-deployment')
# Data diagrams are generated from actual additive SQL migrations, not from the old PostgreSQL proposal.
sets={'identity':['identity'],'traceability':['lots','messaging'],'logistics':['logistics'],'processing':['processing'],'jewelry':['jewelry'],'certification':['certification'],'devices':['devices'],'reporting':['reporting']};models={}
for owner,folders in sets.items():
 tables=[]
 for folder in folders:
  for sqlfile in sorted((ROOT/'database/migrations'/folder).glob('*.sql')):
   sql=sqlfile.read_text(encoding='utf-8')
   for m in re.finditer(r'CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\((.*?)\) ENGINE',sql,re.S|re.I):
    name,body=m.groups();columns=re.findall(r'(?:^|,)\s*(\w+)\s+(CHAR|VARCHAR|INT|BIGINT|DECIMAL|BOOLEAN|JSON|DATETIME|LONGBLOB|LONGTEXT|TEXT)\b',body,re.I)
    key=re.search(r'PRIMARY KEY\s*\(([^)]+)\)',body,re.I);inline=re.search(r'(?:^|,)\s*(\w+)\s+[^,]+?PRIMARY KEY',body,re.I)
    keys=key[1].replace(' ','') if key else inline[1] if inline else 'consultar SQL'
    fks=[{'columns':a,'table':b,'target':c} for a,b,c in re.findall(r'FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s*(\w+)\s*\(([^)]+)\)',body,re.I)]
    tables.append({'table':name,'primaryKey':keys,'columns':[{'name':n,'type':t.upper()} for n,t in columns],'foreignKeys':fks,'source':str(sqlfile.relative_to(ROOT)).replace('\\','/')})
 models[owner]=tables;cols=2 if len(tables)<=6 else 3;rows=math.ceil(len(tables)/cols);height=170+rows*265+130
 fig=Figure(owner.title()+' modelo relacional resumido','Tablas reales, claves y campos principales; esquema completo en database/migrations',h=height)
 for index,table in enumerate(tables):
  col=index%cols;row=index//cols;x=35+col*(1430/cols);y=145+row*265;width=1430/cols-22
  others=[c['name']+' '+c['type'] for c in table['columns'] if c['name'] not in table['primaryKey'].split(',')]
  body=['PK '+table['primaryKey']]+others[:3]
  if table['foreignKeys']:body[-1]='FK → '+', '.join(sorted(set(k['table'] for k in table['foreignKeys'])))
  fig.box(x,y,width,245,table['table'],body,kind='Table',size=24)
 fig.text(38,height-90,'Aislamiento: tenant_id en consultas y claves de negocio; sin FK ni joins entre bases de servicios.',23)
 fig.save('data-'+owner)
(OUT/'data-model.json').write_text(json.dumps(models,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Generated',len(list(OUT.glob('*.png'))),'figures and',sum(len(v) for v in models.values()),'SQL tables')
