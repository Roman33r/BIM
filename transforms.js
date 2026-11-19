import {findElement} from './elements.js';
import {angleGeometry} from './annotations.js';
import {isLinearStructure,isRoundStructure,isPileCap,pileFootprintDiameter} from './structures.js';
import {guidePoints} from './construction-guides.js';
import {capHoles,isFastener} from './hardware.js';
export const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
export const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
export const mul=(a,k)=>({x:a.x*k,y:a.y*k});
export const dot=(a,b)=>a.x*b.x+a.y*b.y;
export const length=a=>Math.hypot(a.x,a.y);
export const midpoint=(a,b)=>mul(add(a,b),.5);
export const normalAngle=angle=>((angle+180)%360+360)%360-180;
export function rotatePoint(point,center,angle){const p=sub(point,center),r=angle*Math.PI/180;return add(center,{x:p.x*Math.cos(r)-p.y*Math.sin(r),y:p.x*Math.sin(r)+p.y*Math.cos(r)});}
export function framePoint(frame,x,y){return add(frame.origin,add(mul(frame.u,x),mul(frame.v,y)));}
export function elementAngle(e,host){const edge=host||e;if(e.mode==='angle')return Math.atan2(e.a.y-e.vertex.y,e.a.x-e.vertex.x)*180/Math.PI;return edge.a?Math.atan2(edge.b.y-edge.a.y,edge.b.x-edge.a.x)*180/Math.PI:e.rotation||0;}
export function elementFrame(e,host){
 const angle=elementAngle(e,host)*Math.PI/180,u={x:Math.cos(angle),y:Math.sin(angle)},v={x:-u.y,y:u.x};
 let origin,w,h;
 if(host){w=e.width;h=host.thickness;const center=add(host.a,mul(u,e.position));origin=sub(sub(center,mul(u,w/2)),mul(v,h/2));}
 else if(e.mode==='angle'){origin=e.vertex;w=0;h=0;}
 else if(e.kind==='guide'&&e.type==='point'){origin={x:e.x,y:e.y};w=h=0;}
 else if(e.a){w=length(sub(e.b,e.a));h=e.kind==='wall'||isLinearStructure(e)?e.thickness:0;origin=sub(e.a,mul(v,h/2));}
 else if(isRoundStructure(e)){w=h=pileFootprintDiameter(e);origin={x:e.x-w/2,y:e.y-h/2};}
 else if(isFastener(e)){w=h=e.headDiameter;origin=sub(sub(e,mul(u,w/2)),mul(v,h/2));}
 else if(isPileCap(e)){w=e.w;h=e.d;origin=sub(sub(e,mul(u,w/2)),mul(v,h/2));}
 else if(e.points){const xs=e.points.map(p=>dot(p,u)),ys=e.points.map(p=>dot(p,v)),left=Math.min(...xs),top=Math.min(...ys);origin=add(mul(u,left),mul(v,top));w=Math.max(...xs)-left;h=Math.max(...ys)-top;}
 else{origin={x:e.x,y:e.y};w=e.w;h=e.d??e.h;}
 const frame={origin,w,h,u,v};frame.center=framePoint(frame,w/2,h/2);return frame;
}
export function elementFootprint(e,host){
 if(e.points)return e.points;
 if(isRoundStructure(e)){
  const radius=pileFootprintDiameter(e)/2;
  return Array.from({length:24},(_,i)=>({x:e.x+radius*Math.cos(i*Math.PI/12),y:e.y+radius*Math.sin(i*Math.PI/12)}));
 }
 const f=elementFrame(e,host);
 return [[0,0],[f.w,0],[f.w,f.h],[0,f.h]].map(([x,y])=>framePoint(f,x,y));
}
export function elementAxes(e,host){
 if(e.kind==='guide')return [];
 if(e.showAxes===false)return [];
 if(e.mode==='angle')return [{center:e.vertex,direction:mul(sub(angleGeometry(e).middle,e.vertex),1/e.radius),extent:e.radius+.3}];
 const f=elementFrame(e,host);return [{center:f.center,direction:f.u,extent:Math.max(.3,f.w/2+.3)},{center:f.center,direction:f.v,extent:Math.max(.3,f.h/2+.3)}];
}
export function elementAnchors(e,host){
 if(e.kind==='guide'){
  const points=guidePoints(e);
  if(e.type==='line')points.push({...midpoint(e.a,e.b),role:'Середина линии'});
  return points;
 }
 if(e.mode==='angle')return [{...e.vertex,role:'Вершина угла'},{...e.a,role:'Конец'},{...e.b,role:'Конец'},{...angleGeometry(e).middle,role:'Середина дуги'}];
 if(isRoundStructure(e)){
  const center={x:e.x,y:e.y};
  const edge=(diameter,role)=>{
   const r=diameter/2;
   return [{x:r,y:0},{x:0,y:r},{x:-r,y:0},{x:0,y:-r}].map(p=>({...add(center,p),role}));
  };
  const points=[{...center,role:'Центр'},...edge(e.diameter,'Край ствола')];
  if(e.type==='screwPile')points.push(...edge(e.bladeDiameter,'Край лопасти'));
  return points;
 }
 const f=elementFrame(e,host),points=[];
 for(const [x,y,role] of [[0,0,'Угол'],[.5,0,'Середина'],[1,0,'Угол'],[1,.5,'Середина'],[1,1,'Угол'],[.5,1,'Середина'],[0,1,'Угол'],[0,.5,'Середина'],[.5,.5,'Центр']])points.push({...framePoint(f,f.w*x,f.h*y),role});
 if(e.a)points.push({...e.a,role:'Конец'},{...e.b,role:'Конец'});
 if(e.points){for(let i=0;i<e.points.length;i++)points.push({...e.points[i],role:'Угол'},{...midpoint(e.points[i],e.points[(i+1)%e.points.length]),role:'Середина'});}
 if(e.kind==='dimension'){const shift=mul(f.v,e.offset);points.push({...add(e.a,shift),role:'Конец размера'},{...add(e.b,shift),role:'Конец размера'},{...add(f.center,shift),role:'Середина размера'});}
 if(isPileCap(e))points.push(...capHoles(e).map((p,i)=>({...p,role:'Центр отверстия '+(i+1)})));
 return points;
}
export function transformHandles(e,host,unit=.02){
 const f=elementFrame(e,host),handles=[];const put=(key,p,label,cursor='crosshair')=>handles.push({key,...p,label,cursor});
 if(e.kind==='guide'){
  if(e.type==='point')return [];
  put('a',e.a,'Начало вспомогательной линии');put('b',e.b,'Конец вспомогательной линии');
 }
 else if(e.kind==='wall'||isLinearStructure(e)){
  const wall=e.kind==='wall';
  put('a',e.a,wall?'Начало стены':'Начало элемента');put('b',e.b,wall?'Конец стены':'Конец элемента');
  put('thickness',framePoint(f,f.w/2,f.h),wall?'Толщина стены':'Ширина сечения','ns-resize');
 }
 else if(isFastener(e)){
  put('diameter',framePoint(f,f.w/2+e.diameter/2,f.h/2),'Диаметр крепежа','ew-resize');
  put('headDiameter',framePoint(f,0,f.h/2),'Габарит головки','ew-resize');
 }
 else if(isRoundStructure(e)){
  put('diameter',{x:e.x+e.diameter/2,y:e.y},e.type==='screwPile'?'Диаметр ствола':'Диаметр сваи','ew-resize');
  if(e.type==='screwPile')put('bladeDiameter',{x:e.x-e.bladeDiameter/2,y:e.y},'Диаметр лопасти','ew-resize');
 }
 else if(host){put('left',framePoint(f,0,f.h/2),'Левый край проёма','ew-resize');put('right',framePoint(f,f.w,f.h/2),'Правый край проёма','ew-resize');}
 else if(e.mode==='angle'){put('a',e.a,'Первый луч');put('vertex',e.vertex,'Вершина угла');put('b',e.b,'Второй луч');put('radius',angleGeometry(e).middle,'Радиус дуги','move');}
 else if(e.kind==='dimension'){put('a',e.a,'Первая точка размера');put('b',e.b,'Вторая точка размера');put('offset',add(f.center,mul(f.v,e.offset)),'Положение размерной линии','move');}
 else if(e.points){e.points.forEach((p,i)=>{put('vertex-'+i,p,'Вершина '+(i+1));put('edge-'+i,midpoint(p,e.points[(i+1)%e.points.length]),'Середина грани '+(i+1));});}
 else{for(const [key,x,y,cursor] of [['nw',0,0,'nwse-resize'],['n',.5,0,'ns-resize'],['ne',1,0,'nesw-resize'],['e',1,.5,'ew-resize'],['se',1,1,'nwse-resize'],['s',.5,1,'ns-resize'],['sw',0,1,'nesw-resize'],['w',0,.5,'ew-resize']])put(key,framePoint(f,f.w*x,f.h*y),'Изменить размер · '+key,cursor);}
 if(!host&&!isRoundStructure(e)){const base=framePoint(f,f.w/2,0);put('rotate',sub(base,mul(f.v,30*unit)),'Повернуть элемент','grab');}
 return handles;
}
export function rotateElement(floor,id,degrees){
 const found=findElement(floor,id);if(!found)throw new Error('Элемент не найден.');const {element:e,host}=found;if(host)throw new Error('Поворот проёма определяется стеной.');
 const f=elementFrame(e),center=f.center;
 if(e.kind==='guide'&&e.type==='point')return found;
 if(e.a){e.a=rotatePoint(e.a,center,degrees);e.b=rotatePoint(e.b,center,degrees);}
 else if(e.points){e.points=e.points.map(p=>rotatePoint(p,center,degrees));e.rotation=normalAngle((e.rotation||0)+degrees);}
 else if(!isRoundStructure(e)){const origin=rotatePoint({x:e.x,y:e.y},center,degrees);e.x=origin.x;e.y=origin.y;e.rotation=normalAngle((e.rotation||0)+degrees);}
 return found;
}
export function setElementAngle(floor,id,angle){
 const found=findElement(floor,id);
 if(!found||found.host||isRoundStructure(found.element)||!Number.isFinite(angle))throw new Error('Угол поворота недоступен.');
 return rotateElement(floor,id,normalAngle(angle-elementAngle(found.element)));
}
export function resizeElement(floor,id,handle,point){
 const found=findElement(floor,id);if(!found)throw new Error('Элемент не найден.');const {element:e,host}=found,f=elementFrame(e,host);
 if(e.kind==='guide'){
  if(e.type==='line'&&['a','b'].includes(handle))e[handle]={...point};
 }
 else if(e.kind==='wall'||isLinearStructure(e)){
  if(handle==='thickness'){
   const wall=e.kind==='wall',min=wall ? .05 : Math.max(.02,(e.gauge||0)/.9);
   e.thickness=Math.max(min,Math.min(wall?1.5:10,2*Math.abs(dot(sub(point,f.center),f.v))));
  }else if(['a','b'].includes(handle))e[handle]={...point};
 }
 else if(isFastener(e)){
  const diameter=2*length(sub(point,f.center));
  const factor=e.type==='nut'?Math.cos(Math.PI/6):1;
  if(handle==='diameter')e.diameter=Math.max(.001,Math.min(.2,(e.headDiameter-.001)*factor,diameter));
  if(handle==='headDiameter')e.headDiameter=Math.max(e.diameter/factor+.001,Math.min(.4,diameter));
 }
 else if(isRoundStructure(e)){
  const diameter=2*length(sub(point,f.center));
  if(handle==='diameter')e.diameter=Math.max(.05,Math.min(e.type==='screwPile'?e.bladeDiameter-.01:10,diameter));
  if(handle==='bladeDiameter'&&e.type==='screwPile')e.bladeDiameter=Math.max(e.diameter+.01,Math.min(10,diameter));
 }
 else if(isPileCap(e)&&e.pileId!==undefined){
  const p=sub(point,f.center);
  if(handle.includes('w')||handle.includes('e'))e.w=Math.max(.05,Math.min(30,2*Math.abs(dot(p,f.u))));
  if(handle.includes('n')||handle.includes('s'))e.d=Math.max(.05,Math.min(30,2*Math.abs(dot(p,f.v))));
 }
 else if(host){const along=dot(sub(point,host.a),f.u),left=e.position-e.width/2,right=e.position+e.width/2;let min=.08+1e-9,max=length(sub(host.b,host.a))-.08-1e-9;for(const o of host.openings){if(o.id===id)continue;if(o.position<e.position)min=Math.max(min,o.position+o.width/2+.08+1e-9);else max=Math.min(max,o.position-o.width/2-.08-1e-9);}const start=handle==='left'?Math.max(min,Math.min(right-.300000001,along)):left,end=handle==='right'?Math.min(max,Math.max(left+.300000001,along)):right;e.width=end-start;e.position=(start+end)/2;}
 else if(e.mode==='angle'){if(handle==='radius')e.radius=Math.max(.05,Math.min(100,length(sub(point,e.vertex))));else if(['a','vertex','b'].includes(handle))e[handle]={...point};}
 else if(e.kind==='dimension'){if(handle==='offset')e.offset=dot(sub(point,e.a),f.v);else if(['a','b'].includes(handle))e[handle]={...point};}
 else if(e.points){const index=Number(handle.split('-')[1]);if(handle.startsWith('vertex-'))e.points[index]={...point};else if(handle.startsWith('edge-')){const next=(index+1)%e.points.length,edge=sub(e.points[next],e.points[index]),len=length(edge),normal={x:-edge.y/len,y:edge.x/len},delta=mul(normal,dot(sub(point,midpoint(e.points[index],e.points[next])),normal));e.points[index]=add(e.points[index],delta);e.points[next]=add(e.points[next],delta);}}
 else{const p=sub(point,f.origin),px=dot(p,f.u),py=dot(p,f.v),min=e.kind==='room'?.100000001:.050000001,max=e.kind==='room'?100:30;let left=0,top=0,right=f.w,bottom=f.h;if(handle.includes('w'))left=Math.max(right-max,Math.min(right-min,px));if(handle.includes('e'))right=Math.min(left+max,Math.max(left+min,px));if(handle.includes('n'))top=Math.max(bottom-max,Math.min(bottom-min,py));if(handle.includes('s'))bottom=Math.min(top+max,Math.max(top+min,py));const origin=isPileCap(e)?framePoint(f,(left+right)/2,(top+bottom)/2):framePoint(f,left,top);e.x=origin.x;e.y=origin.y;e.w=right-left;if(e.kind==='room')e.h=bottom-top;else e.d=bottom-top;}
 return found;
}
export function isSimplePolygon(points){
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),on=(p,a,b)=>Math.abs(cross(a,b,p))<1e-9&&p.x>=Math.min(a.x,b.x)-1e-9&&p.x<=Math.max(a.x,b.x)+1e-9&&p.y>=Math.min(a.y,b.y)-1e-9&&p.y<=Math.max(a.y,b.y)+1e-9;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(length(sub(b,a))<.02)return false;for(let j=i+1;j<points.length;j++){if(j===i+1||i===0&&j===points.length-1)continue;const c=points[j],d=points[(j+1)%points.length];if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(c,a,b)||on(d,a,b)||on(a,c,d)||on(b,c,d))return false;}}
 return true;
}
