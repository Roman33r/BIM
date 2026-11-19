import {migrateElements,FURNITURE_TYPES,listElements} from './elements.js';
import {isSimplePolygon} from './transforms.js';
import {angleValue} from './annotations.js';
import {STRUCTURE_TYPES,isPileCap,isRoundStructure,syncPileCaps} from './structures.js';
export const clone = value => structuredClone(value);
export const wallLength = wall => Math.hypot(wall.b.x-wall.a.x,wall.b.y-wall.a.y);
export const uid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
export function projectPoint(point,wall){
  const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,length=wallLength(wall);
  const distance=length ? Math.max(0,Math.min(length,((point.x-wall.a.x)*dx+(point.y-wall.a.y)*dy)/length)) : 0;
  const x=wall.a.x+dx*(distance/(length||1)),y=wall.a.y+dy*(distance/(length||1));
  return {x,y,distance,offset:Math.hypot(point.x-x,point.y-y)};
}
export function polygonArea(points){return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y},0))/2;}
export function canPlaceOpening(wall,opening,exceptId=null){
  const length=wallLength(wall),start=opening.position-opening.width/2,end=opening.position+opening.width/2;
  const margin=.08,tolerance=1e-9;
  return opening.width>=0.3&&opening.height>=0.3&&opening.sill>=0&&opening.sill+opening.height<=wall.height+0.0001
   &&start>=margin-tolerance&&end<=length-margin+tolerance
   &&wall.openings.every(other=>other.id===exceptId||end+margin<=other.position-other.width/2+tolerance||start-margin>=other.position+other.width/2-tolerance);
}
export function openingSpan({position,width}){return [position-width/2,position+width/2];}
export function wallSegments(wall){
  const length=wallLength(wall);let cursor=0;const result=[];
  for(const opening of [...wall.openings].sort((a,b)=>a.position-b.position)){
    const [left,right]=openingSpan(opening),start=Math.max(0,left),end=Math.min(length,right);
    if(start>cursor)result.push([cursor,start]);cursor=Math.max(cursor,end);
  }
  if(cursor<length)result.push([cursor,length]);return result;
}
export function wallBlocks(wall,height=wall.height){
 const blocks=wallSegments(wall).map(([start,end])=>({start,end,bottom:0,top:height}));
 for(const opening of wall.openings){
  const [start,end]=openingSpan(opening),lintel=opening.sill+opening.height;
  if(opening.sill>0)blocks.push({start,end,bottom:0,top:Math.min(opening.sill,height)});
  if(lintel<height)blocks.push({start,end,bottom:lintel,top:height});
 }
 return blocks;
}
function makeWall(id,a,b,openings=[],outer=false){return {id,kind:'wall',name:outer?'Наружная стена':'Внутренняя стена',a:{x:a[0],y:a[1]},b:{x:b[0],y:b[1]},thickness:outer?0.3:0.15,height:3,material:outer?'Кирпич':'Газобетон',loadBearing:outer,openings};}
const windowAt=(id,position,width=1.8)=>({id,kind:'window',name:'Окно',position,width,height:1.5,sill:0.9});
const doorAt=(id,position,width=0.9)=>({id,kind:'door',name:'Дверь',position,width,height:2.1,sill:0});
export function createDemo(){
 const walls=[makeWall('СТ-001',[0,0],[12,0],[windowAt('ОК-001',2.1),doorAt('ДВ-001',6,1.2),windowAt('ОК-002',10.1)],true),makeWall('СТ-014',[12,0],[12,9],[windowAt('ОК-003',1.9,1.6),windowAt('ОК-004',6.7,2.4)],true),makeWall('СТ-003',[12,9],[0,9],[windowAt('ОК-005',2.2,2),doorAt('ДВ-002',6,1.8),windowAt('ОК-006',9.8,2)],true),makeWall('СТ-004',[0,9],[0,0],[windowAt('ОК-007',2.1,1.8),windowAt('ОК-008',7.2,1.6)],true),makeWall('СТ-005',[4.2,0],[4.2,3.5],[doorAt('ДВ-003',2.65)]),makeWall('СТ-006',[8,0],[8,4.5],[doorAt('ДВ-004',3.55,1)]),makeWall('СТ-007',[0,3.5],[4.2,3.5]),makeWall('СТ-008',[2.5,3.5],[2.5,5.5],[doorAt('ДВ-005',1,0.75)]),makeWall('СТ-009',[0,5.5],[4.2,5.5],[doorAt('ДВ-006',3.2,0.8)]),makeWall('СТ-010',[4.2,3.5],[4.2,5.5],[doorAt('ДВ-007',1,0.8)])];
 const floor={id:'floor-1',name:'1 этаж',elevation:0,height:3,walls,slabs:[{id:'ПЛ-001',kind:'slab',name:'Перекрытие',thickness:0.2,material:'Бетон',points:[{x:0,y:0},{x:12,y:0},{x:12,y:9},{x:0,y:9}]}],dimensions:[],rooms:[{name:'Кабинет',x:0.15,y:0.15,w:3.97,h:3.27},{name:'Холл',x:4.28,y:0.15,w:3.64,h:5.27},{name:'Кухня',x:8.08,y:0.15,w:3.77,h:4.27},{name:'Санузел',x:0.15,y:3.58,w:2.27,h:1.84},{name:'Постирочная',x:2.58,y:3.58,w:1.54,h:1.84},{name:'Гостиная',x:0.15,y:5.58,w:11.7,h:3.27}]};
 const upper=clone(floor);upper.id='floor-2';upper.name='2 этаж';upper.elevation=3;upper.rooms[0].name='Спальня';upper.rooms[2].name='Детская';upper.rooms[5].name='Спальня';upper.walls.forEach(w=>{w.id+='-2';w.openings.forEach(o=>o.id+='-2')});upper.slabs[0].id='ПЛ-002';
 return migrateElements({schemaVersion:1,name:'Дом в сосновом бору',updatedAt:new Date().toISOString(),floors:[floor,upper]});
}
export function createEmptyProject(name='Новый проект'){
 return {schemaVersion:1,contentVersion:2,id:uid('project'),name:name.trim()||'Новый проект',updatedAt:new Date().toISOString(),floors:[{id:uid('floor'),name:'1 этаж',elevation:0,height:3,walls:[],slabs:[],rooms:[],dimensions:[],furniture:[],structures:[]}]};
}
export function validateProject(value){
 const fail=()=>{throw new Error('Файл не соответствует формату проекта версии 1.');};
 const num=(n,min=-1000,max=1000)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 const str=(s,max=100)=>typeof s==='string'&&s.length>0&&s.length<=max;
 const point=p=>p&&num(p.x)&&num(p.y);
 if(!value||value.schemaVersion!==1||!str(value.name)||!Array.isArray(value.floors)||!value.floors.length||value.floors.length>20)fail();
 if(value.contentVersion!==undefined&&value.contentVersion!==2)fail();
 for(const f of value.floors)if(!f||!Array.isArray(f.walls)||!Array.isArray(f.slabs)||!Array.isArray(f.rooms)||!Array.isArray(f.dimensions)||f.rooms.some(r=>!r||typeof r!=='object')||f.dimensions.some(d=>!d||typeof d!=='object'))fail();
 migrateElements(value);
 const ids=new Set();const id=s=>{if(!str(s)||ids.has(s))fail();ids.add(s)};
 if(!str(value.id))fail();
 for(const f of value.floors){
  id(f.id);if(!str(f.name)||!num(f.elevation,-100,200)||!num(f.height,1,15)||!Array.isArray(f.walls)||f.walls.length>2000||!Array.isArray(f.slabs)||f.slabs.length>200||!Array.isArray(f.rooms)||f.rooms.length>500||!Array.isArray(f.dimensions)||f.dimensions.length>1000)fail();
  for(const w of f.walls){id(w.id);if(w.kind!=='wall'||!str(w.name)||!str(w.material)||!point(w.a)||!point(w.b)||!num(wallLength(w),0.2,100)||!num(w.thickness,0.05,1.5)||!num(w.height,1,15)||!Array.isArray(w.openings)||w.openings.length>100)fail();for(const o of w.openings){id(o.id);if(!['door','doorway','window'].includes(o.kind)||!str(o.name)||!num(o.position,0,100)||!num(o.width,0.3,10)||!num(o.height,0.3,15)||!num(o.sill,0,15)||!canPlaceOpening(w,o,o.id))fail();}}
  for(const s of f.slabs){id(s.id);if(s.kind!=='slab'||!str(s.name)||!str(s.material)||!num(s.thickness,0.05,1.5)||!Array.isArray(s.points)||s.points.length<3||s.points.length>200||!s.points.every(point)||polygonArea(s.points)<0.1||!isSimplePolygon(s.points)||!num(s.rotation??0,-360,360))fail();}
  for(const r of f.rooms){id(r.id);if(r.kind!=='room'||!str(r.name)||!num(r.x)||!num(r.y)||!num(r.w,0.1,100)||!num(r.h,0.1,100)||!num(r.rotation??0,-360,360))fail();}
  for(const d of f.dimensions){
   id(d.id);if(d.kind!=='dimension'||!str(d.name)||!point(d.a)||!point(d.b))fail();
   if(d.mode==='angle'){
    if(!point(d.vertex)||!num(d.radius,.05,100)
     ||Math.hypot(d.a.x-d.vertex.x,d.a.y-d.vertex.y)<.01
     ||Math.hypot(d.b.x-d.vertex.x,d.b.y-d.vertex.y)<.01||angleValue(d)<.01)fail();
   }else if(d.mode!==undefined||!num(d.offset,-100,100)||!num(wallLength(d),.01,3000))fail();
  }
  if(!Array.isArray(f.furniture)||f.furniture.length>2000)fail();
  for(const e of f.furniture){id(e.id);if(e.kind!=='furniture'||!Object.hasOwn(FURNITURE_TYPES,e.type)||!str(e.name)||!num(e.x)||!num(e.y)||!num(e.w,.05,30)||!num(e.d,.05,30)||!num(e.height,.005,15)||!num(e.rotation,-360,360))fail();}
  if(!Array.isArray(f.structures)||f.structures.length>2000)fail();
  for(const e of f.structures){
   if(!e||typeof e!=='object'||!Object.hasOwn(STRUCTURE_TYPES,e.type))fail();
   const spec=STRUCTURE_TYPES[e.type];
   id(e.id);
   if(e.kind!==spec.kind||!str(e.name)||!str(e.material)||!num(e.elevation,-100,isPileCap(e)?130:100)
    ||!num(e.height,isPileCap(e) ? .005 : .02,30))fail();
   if(spec.shape==='line'){
    if(!point(e.a)||!point(e.b)||!num(wallLength(e),.05,100)||!num(e.thickness,.02,10))fail();
    if(spec.sizes.gauge!==undefined&&!num(e.gauge,.001,Math.min(e.thickness*.9,e.height*.45)))fail();
   }else if(spec.shape==='contour'){
    if(!Array.isArray(e.points)||e.points.length<3||e.points.length>200||!e.points.every(point)
     ||polygonArea(e.points)<.1||!isSimplePolygon(e.points)||!num(e.rotation??0,-360,360))fail();
   }else if(!point(e))fail();
   else if(spec.shape==='round'){
    if(!num(e.diameter,.05,e.type==='screwPile'?9.99:10))fail();
    if(e.type==='screwPile'&&(!num(e.bladeDiameter,e.diameter+.01-1e-9,10)||!num(e.bladeThickness,.002,.06)
     ||!num(e.bladePitch,.01,e.height*.7-e.bladeThickness)))fail();
   }
   else if(!num(e.w,.05,30)||!num(e.d,.05,30)||!num(e.rotation,-360,360))fail();
  }
  const piles=new Set(f.structures.filter(isRoundStructure).map(e=>e.id)),capped=new Set();
  for(const e of f.structures){
   if(!isPileCap(e)||e.pileId===undefined)continue;
   if(!piles.has(e.pileId)||capped.has(e.pileId))fail();
   capped.add(e.pileId);
  }
  syncPileCaps(f);
  for(const e of listElements(f))if(e.showAxes!==undefined&&typeof e.showAxes!=='boolean')fail();
 }
 return value;
}
