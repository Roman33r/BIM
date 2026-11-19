import {elementFootprint,elementFrame,framePoint} from './transforms.js';
import {verticalRange} from './vertical.js';
import {isStructure,isPileCap,isRoundStructure,makeStructure,memberProfile,rimBoardSegments} from './structures.js';
import {isFastener,capHoles,FASTENER_TYPES} from './hardware.js';
import {boardMountPoints} from './board-mounts.js';
import {elementTilts,applyElementTilts,convexOutline} from './spatial.js';

const eps=1e-7;
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function edgeDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
export function pointInside(p,polygon,clearance=0){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[j],b=polygon[i];if(edgeDistance(p,a,b)<=clearance+eps)return false;
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
export function footprintsOverlap(a,b){
 const bounds=p=>({left:Math.min(...p.map(v=>v.x)),right:Math.max(...p.map(v=>v.x)),top:Math.min(...p.map(v=>v.y)),bottom:Math.max(...p.map(v=>v.y))}),x=bounds(a),y=bounds(b);
 if(Math.min(x.right,y.right)-Math.max(x.left,y.left)<=eps||Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)<=eps)return false;
 for(const p of a)if(pointInside(p,b))return true;for(const p of b)if(pointInside(p,a))return true;
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(cross(a[i],a[(i+1)%a.length],b[j])*cross(a[i],a[(i+1)%a.length],b[(j+1)%b.length])<-eps*eps&&cross(b[j],b[(j+1)%b.length],a[i])*cross(b[j],b[(j+1)%b.length],a[(i+1)%a.length])<-eps*eps)return true;
 for(const [poly,other] of [[a,b],[b,a]]){
  const area=poly.reduce((s,p,i)=>s+p.x*poly[(i+1)%poly.length].y-poly[(i+1)%poly.length].x*p.y,0),sign=Math.sign(area);
  for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],length=Math.hypot(q.x-p.x,q.y-p.y)||1,sample={x:(p.x+q.x)/2-sign*(q.y-p.y)/length*1e-6,y:(p.y+q.y)/2+sign*(q.x-p.x)/length*1e-6};if(pointInside(sample,poly)&&pointInside(sample,other))return true;}
 }
 return false;
}
export const canSurfacePlace=e=>['wall','slab','furniture','framing'].includes(e.kind)||isPileCap(e)&&e.pileId===undefined;
export const canFixPart=e=>e.kind==='framing'||e.kind==='slab'||e.kind==='foundation'&&!isPileCap(e)&&!isRoundStructure(e);
export function solidBodies(e,members=[]){
 const [bottom,top]=verticalRange(e);
 if(e.type==='rim')return rimBoardSegments(e,members).map(board=>({footprint:elementFootprint({...e,...board}),bottom,top}));
 if(e.a&&e.kind!=='wall'&&isStructure(e)){
  const length=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),nx=-(e.b.y-e.a.y)/length,ny=(e.b.x-e.a.x)/length;
  return memberProfile(e).map(p=>({footprint:elementFootprint({...e,a:{x:e.a.x+nx*p.offset,y:e.a.y+ny*p.offset},b:{x:e.b.x+nx*p.offset,y:e.b.y+ny*p.offset},thickness:p.width}),bottom:bottom+p.bottom,top:bottom+p.top}));
 }
 return [{footprint:elementFootprint(e),bottom,top}];
}
function shiftHeight(e,delta){if(isStructure(e))e.elevation+=delta;else e.baseElevation=(e.baseElevation||0)+delta;}
function placementBodies(e,members){
 const tilts=elementTilts(e,isPileCap(e)?members.find(p=>p.id===e.pileId):undefined);
 return solidBodies(e,members).map(body=>{
  if(!tilts.length)return body;
  const points=body.footprint.flatMap(p=>[body.bottom,body.top].map(z=>applyElementTilts({...p,z},tilts)));
  return {footprint:convexOutline(points),bottom:Math.min(...points.map(p=>p.z)),top:Math.max(...points.map(p=>p.z))};
 });
}
export function autoPlaceOnSurface(floor,e,excludedIds=[]){
 if(!canSurfacePlace(e)||e.mounts?.length||e.fixings?.length)return 0;
 const excluded=new Set([e.id,...excludedIds]);let total=0;
 const candidates=[...floor.structures,...floor.walls,...floor.slabs,...floor.furniture].filter(p=>!excluded.has(p.id)&&!isFastener(p)&&!(e.kind==='wall'&&p.kind==='wall')).flatMap(p=>placementBodies(p,floor.structures));
 for(let pass=0;pass<=candidates.length;pass++){
  let raise=0;
  for(const body of placementBodies(e,floor.structures))for(const support of candidates){if(body.top<=support.bottom+eps||body.bottom>=support.top-eps)continue;if(footprintsOverlap(body.footprint,support.footprint))raise=Math.max(raise,support.top-body.bottom);}
  if(raise<=eps)return total;shiftHeight(e,raise);total+=raise;
 }
 throw new Error('Не удалось найти свободную поверхность для установки. Задайте отметку вручную.');
}
export function seatOnSurface(floor,e){
 const shape=elementFootprint(e),[bottom,top]=verticalRange(e),supports=[...floor.structures,...floor.walls,...floor.slabs,...floor.furniture].filter(p=>p.id!==e.id&&!isFastener(p)&&verticalRange(p)[0]<top+eps&&footprintsOverlap(shape,elementFootprint(p)));
 if(!supports.length)throw new Error('Под деталью не найдена опора.');
 const surface=Math.max(...supports.map(p=>verticalRange(p)[1]));delete e.mounts;delete e.fixings;shiftHeight(e,surface-bottom);return surface;
}
function localHole(e,point,radius,id){const frame=elementFrame(e),dx=point.x-frame.origin.x,dy=point.y-frame.origin.y;return {id,x:dx*frame.u.x+dy*frame.u.y,y:dx*frame.v.x+dy*frame.v.y,radius,start:0,depth:e.height??e.thickness};}
export function componentHoles(e,members=[]){
 const frame=elementFrame(e),[bottom,top]=verticalRange(e),height=top-bottom,result=[];
 for(const h of e.drillHoles||[]){const p=framePoint(frame,h.x,h.y);result.push({...p,radius:h.radius,bottom:bottom+(h.start||0),top:Math.min(top,bottom+(h.start||0)+(h.depth??height)),id:h.id});}
 if(e.type==='rimBoard'&&e.mounts?.length)for(const {point} of boardMountPoints(e,members))if(!result.some(h=>Math.hypot(h.x-point.x,h.y-point.y)<1e-6))result.push({...point,bottom,top});
 return result;
}
export function partCapContacts(floor,part){
 if(!canFixPart(part)||part.tiltX||part.tiltY)return [];
 const bodies=solidBodies(part,floor.structures),[bottom,top]=verticalRange(part),result=[];
 for(const cap of floor.structures.filter(isPileCap)){
  const pile=floor.structures.find(e=>e.id===cap.pileId);if(cap.tiltX||cap.tiltY||pile?.tiltX||pile?.tiltY)continue;
  const holes=capHoles(cap).map((p,index)=>({...p,index})).filter(p=>bodies.some(body=>pointInside(p,body.footprint,p.radius+.001)));
  if(!holes.length)continue;
  const [low,high]=verticalRange(cap),side=Math.abs(bottom-high)<.001?'above':Math.abs(top-low)<.001?'below':null;
  result.push({cap,holes,side});
 }
 return result;
}
function isThroughFastener(type){const spec=FASTENER_TYPES[type];return type==='bolt'||type==='anchor'||spec?.pointed===false;}
function positionFixing(part,cap,point,fastener,hole,side,accessories){
 const [bottom,top]=verticalRange(part),[capBottom,capTop]=verticalRange(cap),washer=accessories[0],through=isThroughFastener(fastener.type),washerHeight=washer?.height||0;
 fastener.x=point.x;fastener.y=point.y;hole.radius=Math.min(point.radius,(fastener.diameter+(through?.001:0))/2);
 const local=localHole(part,point,hole.radius,hole.id);hole.x=local.x;hole.y=local.y;
 if(fastener.diameter>point.radius*2+eps)throw new Error('Крепёж шире отверстия оголовка.');
 for(const e of accessories){e.diameter=fastener.diameter+(e.type==='washer'?.0005:0);e.headDiameter=e.type==='washer'?Math.max(fastener.diameter*2.3,point.radius*2+.006):Math.max(fastener.diameter*1.85,fastener.diameter/Math.cos(Math.PI/6)+.001);}
 if(through){
  const jointTop=Math.max(top,capTop),jointBottom=Math.min(bottom,capBottom),bottomWasher=accessories[1],nut=accessories[2];
  fastener.elevation=jointTop+washerHeight;delete fastener.tiltX;delete fastener.tiltY;
  fastener.height=Math.max(fastener.height,jointTop-jointBottom+washerHeight+(bottomWasher?.height||0)+(nut?.height||0)+.01);
  if(washer)washer.elevation=jointTop;
  if(bottomWasher)bottomWasher.elevation=jointBottom-bottomWasher.height;
  if(nut)nut.elevation=jointBottom-(bottomWasher?.height||0)-nut.height;
  hole.start=0;hole.depth=top-bottom;
 }else{
  const above=side==='above';fastener.elevation=above?capBottom-washerHeight:capTop+washerHeight;
  fastener.tiltX=above?180:0;delete fastener.tiltY;
  fastener.height=Math.max(fastener.height,cap.height+washerHeight+.01);
  const penetration=Math.min(top-bottom,fastener.height-cap.height-washerHeight);hole.depth=penetration;hole.start=above?0:top-bottom-penetration;
  if(washer)washer.elevation=above?capBottom-washerHeight:capTop;
 }
 for(const e of accessories){e.x=point.x;e.y=point.y;}
 if(fastener.height>2||Math.abs(fastener.elevation)>100||accessories.some(e=>e.headDiameter>.4||Math.abs(e.elevation)>100))throw new Error('Размеры соединения превышают допустимый диапазон крепежа.');
}
export function createPartFixings(floor,part,type,idFactory,capId){
 if(!FASTENER_TYPES[type]?.sizes.headHeight)throw new Error('Для соединения выберите болт, винт, саморез или гвоздь.');
 const contacts=partCapContacts(floor,part).filter(c=>c.side&&(!capId||c.cap.id===capId));
 if(!contacts.length)throw new Error('Совместите деталь с отверстиями и установите её вплотную к оголовку.');
 part.drillHoles??=[];part.fixings??=[];const created=[];
 for(const contact of contacts)for(const point of contact.holes){
  if(part.fixings.some(f=>f.capId===contact.cap.id&&f.capHoleIndex===point.index))continue;
  const fastener=makeStructure(type,idFactory('КП'),[point]),diameter=fastener.diameter,through=isThroughFastener(type);
  const washer=makeStructure('washer',idFactory('ШБ'),[point]);washer.diameter=diameter+.0005;washer.headDiameter=Math.max(diameter*2.3,point.radius*2+.006);washer.height=.0025;
  const accessories=[washer];
  if(through){const lower={...washer,id:idFactory('ШБ')},nut=makeStructure('nut',idFactory('ГК'),[point]);nut.diameter=diameter;nut.headDiameter=diameter*1.85;nut.height=Math.max(.003,diameter*.8);accessories.push(lower,nut);}
  const hole=localHole(part,point,point.radius,idFactory('ОТ'));
  positionFixing(part,contact.cap,point,fastener,hole,contact.side,accessories);
  part.drillHoles.push(hole);part.fixings.push({capId:contact.cap.id,capHoleIndex:point.index,drillId:hole.id,fastenerId:fastener.id,accessoryIds:accessories.map(e=>e.id),side:contact.side});created.push(fastener,...accessories);
 }
 if(!created.length)throw new Error('Во всех подходящих отверстиях крепёж уже установлен.');
 floor.structures.push(...created);return created;
}
export function syncPartFixings(floor){
 const byId=new Map(floor.structures.map(e=>[e.id,e])),claimed=new Set();
 for(const part of [...floor.structures,...floor.slabs]){
  if(part.fixings!==undefined){
   if(!canFixPart(part)||!Array.isArray(part.fixings)||part.fixings.length>200)throw new Error('Некорректное крепление детали.');
   for(const f of part.fixings){
    if(!f||!Number.isInteger(f.capHoleIndex)||f.capHoleIndex<0||f.capHoleIndex>7||!['above','below'].includes(f.side)||!Array.isArray(f.accessoryIds)||f.accessoryIds.length>3)throw new Error('Некорректное крепление детали.');
    const cap=byId.get(f.capId),fastener=byId.get(f.fastenerId),hole=part.drillHoles?.find(h=>h.id===f.drillId),point=isPileCap(cap)?capHoles(cap)[f.capHoleIndex]:null,accessories=(f.accessoryIds||[]).map(id=>byId.get(id));
    if(!point||!fastener||!isFastener(fastener)||!hole||accessories.some(e=>!e||!isFastener(e))||claimed.has(f.fastenerId))throw new Error('Крепёж или отверстие соединения не найдены. Разъедините крепление.');
    const expected=isThroughFastener(fastener.type)?['washer','washer','nut']:['washer'],hardware=[fastener,...accessories];
    if(!FASTENER_TYPES[fastener.type]?.sizes.headHeight||accessories.length!==expected.length||accessories.some((e,i)=>e.type!==expected[i])||new Set(hardware.map(e=>e.id)).size!==hardware.length||hardware.some(e=>claimed.has(e.id)))throw new Error('Некорректный комплект крепежа соединения.');
    const contact=partCapContacts(floor,part).find(c=>c.cap.id===cap.id&&c.side===f.side&&c.holes.some(h=>h.index===f.capHoleIndex));
    if(!contact)throw new Error('Деталь сместилась относительно оголовка. Сначала разъедините крепление.');
    positionFixing(part,cap,point,fastener,hole,f.side,accessories);hardware.forEach(e=>claimed.add(e.id));
   }
  }
  if(part.drillHoles!==undefined){
   if(!canFixPart(part)||!Array.isArray(part.drillHoles)||part.drillHoles.length>200)throw new Error('Некорректные монтажные отверстия.');
   const ids=new Set(),bodies=solidBodies(part,floor.structures),[bottom,top]=verticalRange(part);
   for(const h of part.drillHoles){
    if(!h||typeof h.id!=='string'||ids.has(h.id)||![h.x,h.y,h.radius,h.start,h.depth].every(Number.isFinite)||h.radius<.0005||h.radius>.1||h.start<0||h.depth<=0||h.start+h.depth>top-bottom+1e-6)throw new Error('Проверьте размеры монтажных отверстий.');
    ids.add(h.id);const p=framePoint(elementFrame(part),h.x,h.y);if(!bodies.some(b=>pointInside(p,b.footprint,h.radius+.0005)))throw new Error('Монтажное отверстие выходит за край детали.');
   }
  }
 }
}
export function componentGeometries(THREE,part,members){
 const holes=componentHoles(part,members),result=[];
 for(const body of solidBodies(part,members)){
  const inside=holes.filter(h=>pointInside(h,body.footprint,h.radius*.999)),levels=[body.bottom,body.top,...inside.flatMap(h=>[Math.max(body.bottom,h.bottom),Math.min(body.top,h.top)])].filter(v=>v>=body.bottom&&v<=body.top).sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>eps);
  for(let i=1;i<levels.length;i++){
   const low=levels[i-1],high=levels[i],shape=new THREE.Shape();body.footprint.forEach((p,j)=>j?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();
   for(const h of inside)if(h.bottom<(low+high)/2&&h.top>(low+high)/2){const path=new THREE.Path();path.absarc(h.x,h.y,h.radius,0,Math.PI*2,true);shape.holes.push(path);}
   result.push({geometry:new THREE.ExtrudeGeometry(shape,{depth:high-low,bevelEnabled:false,curveSegments:20}),top:high});
  }
 }
 return result;
}
export function distributeDrilling(source,parts,members){
 for(const hole of source.drillHoles||[]){
  const point=componentHoles(source,members).find(h=>h.id===hole.id),target=parts.find(e=>pointInside(point,elementFootprint(e),hole.radius+.0005));
  if(!target)throw new Error('Отверстие пересекает стык досок. Измените расположение крепления перед разделением.');
  const local=localHole(target,point,hole.radius,hole.id);(target.drillHoles??=[]).push({...local,start:hole.start,depth:hole.depth});
  const connections=source.fixings?.filter(f=>f.drillId===hole.id)||[];if(connections.length)(target.fixings??=[]).push(...structuredClone(connections));
 }
}
