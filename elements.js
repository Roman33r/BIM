import {isPileCap,isRoundStructure,linkedPileSelection,pileCapFor} from './structures.js';

// Shared element operations for the plan, inspector and 3D viewport.
export const FURNITURE_TYPES={desk:'Рабочий стол',chair:'Стул',table:'Обеденный стол',sofa:'Диван',coffee:'Журнальный столик',bed:'Кровать',plant:'Растение',cabinet:'Кухонный модуль',sink:'Мойка',hob:'Варочная панель',tub:'Ванна',basin:'Раковина',toilet:'Унитаз',washer:'Стиральная машина',stairs:'Лестница',lounger:'Шезлонг',rug:'Ковёр'};
export const FURNITURE_SIZES={desk:[1.6,.7,.76],chair:[.47,.47,.85],table:[1.55,.95,.76],sofa:[2.9,.95,.9],coffee:[1.55,.67,.45],bed:[1.85,2.1,.55],plant:[.4,.4,1],cabinet:[3.4,.62,.9],sink:[.65,.4,.95],hob:[.45,.7,.95],tub:[.75,1.35,.55],basin:[.49,.39,.85],toilet:[.45,.59,.65],washer:[.6,.6,.85],stairs:[1.13,3.3,2.7],lounger:[.7,1.3,.55],rug:[3.42,1.5,.01]};
export const FLOOR_COLLECTIONS=['walls','slabs','furniture','rooms','dimensions','structures','construction'];
export function makeFurniture(type,x,y,id){const [w,d,height]=FURNITURE_SIZES[type];return {id,kind:'furniture',type,name:FURNITURE_TYPES[type],x,y,w,d,height,rotation:0};}
function demoFurniture(floor){
 const items=[];const add=(type,x,y)=>{const f=makeFurniture(type,x,y,`${floor.id}-furniture-${items.length+1}`);items.push(f);return f;};
 const dining=(x,y)=>{add('table',x,y);for(const dx of [.16,.9]){add('chair',x+dx,y-.4);add('chair',x+dx,y+1.02);}add('chair',x-.4,y+.24);add('chair',x+1.61,y+.24);};
 if(floor.elevation===0){add('desk',.9,.65);add('chair',1.46,1.53);dining(9.1,2.3);add('rug',.82,7.22);add('sofa',1.1,6);add('coffee',1.75,7.53);dining(8.6,6.7);}else{add('bed',1.2,.75);add('bed',9,.75);add('bed',2.6,6);}
 add('plant',3.45,.4);add('plant',.35,8.05);add('cabinet',8.25,.23);const side=add('cabinet',11.15,.85);side.w=.5;side.d=1.6;add('sink',9.15,.32);add('hob',11.17,.94);add('tub',.3,3.8);add('basin',1.65,3.76);add('toilet',1.71,4.64);add('washer',2.81,3.8);add('stairs',6.34,.5);
 if(floor.elevation===0){dining(8.7,9.8);add('plant',.2,10.75);add('plant',11.3,10.75);add('lounger',.6,9.65).rotation=-20;}
 return items;
}
export function migrateElements(project){
 if(project.contentVersion!==2){
  for(const floor of project.floors){
   floor.furniture??=demoFurniture(floor);
   if(floor.elevation===0){floor.slabs.push({id:`${floor.id}-terrace`,kind:'slab',name:'Терраса',thickness:.16,material:'Дерево',finish:'deck',points:[{x:-.15,y:9.15},{x:12.15,y:9.15},{x:12.15,y:11.3},{x:-.15,y:11.3}]},{id:`${floor.id}-porch`,kind:'slab',name:'Крыльцо',thickness:.16,material:'Бетон',points:[{x:5.2,y:-1.15},{x:6.8,y:-1.15},{x:6.8,y:-.15},{x:5.2,y:-.15}]});}
   const measured=[[[0,0],[12,0],-1.62],[[0,0],[4.2,0],-1.04],[[4.2,0],[8,0],-1.04],[[8,0],[12,0],-1.04],[[0,9],[0,0],-1.1],[[0,9],[12,9],3.05]];
   measured.forEach(([a,b,offset],i)=>floor.dimensions.push({id:`${floor.id}-dimension-${i+1}`,kind:'dimension',name:'Размер',a:{x:a[0],y:a[1]},b:{x:b[0],y:b[1]},offset}));
  }
  project.contentVersion=2;
 }
 for(const f of project.floors){f.furniture??=[];f.structures??=[];f.construction??=[];f.rooms.forEach((r,i)=>{r.id??=`${f.id}-room-${i+1}`;r.kind='room';});f.dimensions.forEach(d=>{d.kind='dimension';d.name??=d.mode==='angle'?'Угловой размер':'Размер';if(d.mode!=='angle')d.offset??=.5;});}
 project.id??=globalThis.crypto?.randomUUID?.()||`project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 return project;
}
export function findElement(floor,id){
 for(const wall of floor.walls){if(wall.id===id)return {element:wall,collection:'walls'};const opening=wall.openings.find(o=>o.id===id);if(opening)return {element:opening,host:wall,collection:'openings'};}
 for(const collection of FLOOR_COLLECTIONS.slice(1)){const element=floor[collection]?.find(e=>e.id===id);if(element)return {element,collection};}
 return null;
}
export function listElements(floor){return [...floor.walls.flatMap(w=>[w,...w.openings]),...FLOOR_COLLECTIONS.slice(1).flatMap(key=>floor[key]||[])];}
export function moveSelectionToFloor(source,target,ids){
 const selected=linkedPileSelection(source,ids),moved=[];
 for(const key of FLOOR_COLLECTIONS){
  const entities=source[key]||[],items=entities.filter(e=>selected.has(e.id));
  if(!items.length)continue;
  source[key]=entities.filter(e=>!selected.has(e.id));
  (target[key]??=[]).push(...items);
  for(const e of items){
   moved.push(e.id);
   if(e.openings)moved.push(...e.openings.filter(o=>selected.has(o.id)).map(o=>o.id));
  }
 }
 return moved;
}
export function setOpeningDoor(opening,installed){
 const from=installed?'doorway':'door',to=installed?'door':'doorway';
 if(opening.kind!==from)return false;
 const names={door:'Дверь',doorway:'Дверной проём'};
 if(opening.name===names[from])opening.name=names[to];
 opening.kind=to;
 return true;
}
export function elementPosition(element,host){
 if(host){const length=Math.hypot(host.b.x-host.a.x,host.b.y-host.a.y);return {x:host.a.x+(host.b.x-host.a.x)*element.position/length,y:host.a.y+(host.b.y-host.a.y)*element.position/length};}
 if(element.a)return {...(element.mode==='angle'?element.vertex:element.a)};
 if(element.points)return {x:element.points.reduce((s,p)=>s+p.x,0)/element.points.length,y:element.points.reduce((s,p)=>s+p.y,0)/element.points.length};
 return {x:element.x,y:element.y};
}
export function translateElement(floor,id,dx,dy){
 const found=findElement(floor,id);if(!found)throw new Error('Элемент не найден.');
 if(!Number.isFinite(dx)||!Number.isFinite(dy))throw new Error('Некорректное перемещение.');
 const {element:e,host}=found;
 if(isPileCap(e)&&e.pileId!==undefined){translateElement(floor,e.pileId,dx,dy);return found;}
 if(host){
  const length=Math.hypot(host.b.x-host.a.x,host.b.y-host.a.y),delta=(dx*(host.b.x-host.a.x)+dy*(host.b.y-host.a.y))/length;
  const margin=.08+1e-9;let min=e.width/2+margin,max=length-e.width/2-margin;
  for(const other of host.openings){if(other.id===id)continue;if(other.position<e.position)min=Math.max(min,other.position+other.width/2+e.width/2+margin);else max=Math.min(max,other.position-other.width/2-e.width/2-margin);}
  e.position=Math.max(min,Math.min(max,e.position+delta));
 }else if(e.a){for(const p of e.mode==='angle'?[e.a,e.vertex,e.b]:[e.a,e.b]){p.x+=dx;p.y+=dy;}}
 else if(e.points){for(const p of e.points){p.x+=dx;p.y+=dy;}}
 else{e.x+=dx;e.y+=dy;}
 if(isRoundStructure(e)){
  const cap=pileCapFor(floor,e.id);
  if(cap){cap.x=e.x;cap.y=e.y;}
 }
 return found;
}

export function translateSelection(floor, ids, dx, dy){
 const selected = linkedPileSelection(floor,ids), openingsByWall = new Map();
 for (const id of selected) {
  const found = findElement(floor,id);
  if (!found || isPileCap(found.element)&&found.element.pileId!==undefined) continue;
  if (!found.host) {
   translateElement(floor,id,dx,dy);
   continue;
  }
  if (selected.has(found.host.id)) continue;
  if (!openingsByWall.has(found.host)) openingsByWall.set(found.host,[]);
  openingsByWall.get(found.host).push(found.element);
 }
 for (const [wall, openings] of openingsByWall) {
  const length = Math.hypot(wall.b.x-wall.a.x,wall.b.y-wall.a.y);
  const delta = (dx*(wall.b.x-wall.a.x)+dy*(wall.b.y-wall.a.y))/length;
  let min = -Infinity, max = Infinity;
  for (const opening of openings) {
   const margin = .08+1e-9;
   const left = opening.position-opening.width/2, right = opening.position+opening.width/2;
   min = Math.max(min,margin-left);
   max = Math.min(max,length-margin-right);
   for (const neighbor of wall.openings) {
    if (selected.has(neighbor.id)) continue;
    if (neighbor.position < opening.position) min = Math.max(min,neighbor.position+neighbor.width/2+margin-left);
    else max = Math.min(max,neighbor.position-neighbor.width/2-margin-right);
   }
  }
  const shift = delta < 0 ? Math.min(0,Math.max(min,delta)) : Math.max(0,Math.min(max,delta));
  for (const opening of openings) opening.position += shift;
 }
}
