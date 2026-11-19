import {projectedElements,projectView,projectedElementAxes} from './views.js';
import {elementAnchors} from './transforms.js';
import {verticalRange} from './vertical.js';
import {elementTilts,applyElementTilts} from './spatial.js';
import {snapTargets,snapTranslation} from './snapping.js';
import {guidePoints} from './construction-guides.js';
import {findElement,elementPosition} from './elements.js';

export function viewSnapTargets(floor,view,excludedIds=[],options={}){
 const excluded=new Set(excludedIds);
 if(view==='top'||view==='bottom'){
  const targets=snapTargets(floor,excludedIds,options.axes,options),point=p=>({...p,...projectView({...p,z:floor.elevation},view)});
  return {points:targets.points.map(point),lines:targets.lines.map(l=>({...l,center:point(l.center),direction:{x:l.direction.x,y:l.direction.y*(view==='bottom'?-1:1)}})),segments:targets.segments.map(s=>({...s,a:point(s.a),b:point(s.b)}))};
 }
 const points=[],lines=[],segments=[];
 for(const {element:e,parts} of projectedElements(floor,view)){
  if(excluded.has(e.id))continue;
  const host=floor.walls.find(w=>w.openings.some(o=>o.id===e.id));if(host&&excluded.has(host.id))continue;
  const own=[];
  for(const part of parts)for(let i=0;i<part.length;i++){
   const p=part[i],q=part[(i+1)%part.length];own.push({...p,id:e.id,role:'Угол'},{x:(p.x+q.x)/2,y:(p.y+q.y)/2,id:e.id,role:'Середина'});
  }
  if(!own.length)continue;
  const [bottom,top]=verticalRange(e,host),support=host||(e.type==='pileCap'?floor.structures.find(p=>p.id===e.pileId):null),tilts=elementTilts(e,support);
  const project=(p,z)=>{const world=applyElementTilts({...p,z},tilts);return projectView({...world,z:world.z+floor.elevation},view);};
  for(const p of elementAnchors(e,host))for(const z of [bottom,(bottom+top)/2,top])own.push({...project(p,z),id:e.id,role:p.role});
  const xs=own.map(p=>p.x),ys=own.map(p=>p.y),center={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
  own.push({...center,id:e.id,role:'Центр'});
  const unique=new Map();for(const p of own)unique.set(p.x.toFixed(8)+':'+p.y.toFixed(8),p);points.push(...unique.values());
  if(options.axes!==false&&e.showAxes!==false&&options.axisTypes?.[e.kind]!==false){
   lines.push(...projectedElementAxes(floor,e,view,host));
  }
 }
 for(const e of floor.construction||[]){
  if(excluded.has(e.id))continue;
  const projected=guidePoints(e).map(p=>({...projectView({...p,z:floor.elevation},view),id:e.id,role:p.role||'Опорная точка'}));points.push(...projected);
  if(e.type==='line'&&projected.length>=2&&Math.hypot(projected[0].x-projected.at(-1).x,projected[0].y-projected.at(-1).y)>1e-7)segments.push({a:projected[0],b:projected.at(-1),id:e.id});
 }
 return {points,lines,segments};
}
export function viewSnapSet(floor,ids,view,options={}){
 const selected=new Set(ids);for(const wall of floor.walls)if(selected.has(wall.id))for(const opening of wall.openings)selected.add(opening.id);
 for(const board of floor.structures||[])if(board.mounts?.length&&board.mounts.every(m=>selected.has(m.capId)))selected.add(board.id);
 const all=viewSnapTargets(floor,view,[],options);
 const anchors=all.points.filter(p=>selected.has(p.id)),targets={points:all.points.filter(p=>!selected.has(p.id)),lines:all.lines.filter(l=>!selected.has(l.id)),segments:all.segments.filter(s=>!selected.has(s.id))};
 const item=findElement(floor,[...ids][0]);let reference=anchors[0];
 if(item){const e=item.element,[bottom,top]=verticalRange(e,item.host),z=e.elevation??(e.kind==='slab'?e.baseElevation||0:bottom);reference=projectView({...elementPosition(e,item.host),z:z+floor.elevation},view);}
 return {anchors,targets,reference};
}
export function snapViewTranslation(floor,ids,view,dx,dy,tolerance,options={}){
 if(options.onlyAxis==='x')dy=0;if(options.onlyAxis==='y')dx=0;
 const set=options.set||viewSnapSet(floor,ids,view,options);let result={dx,dy,guides:[],marker:null,label:''};
 if(options.snap!==false){
  if(options.onlyAxis){
   const axis=options.onlyAxis,other=axis==='x'?'y':'x';let best=null;
   for(const anchor of set.anchors)for(const target of set.targets.points){
    const moved={x:anchor.x+dx,y:anchor.y+dy},gap=target[axis]-moved[axis];
    if(options.alignment===false&&Math.abs(moved[other]-target[other])>1e-7)continue;
    if(Math.abs(gap)<tolerance&&(!best||Math.abs(gap)<Math.abs(best.gap)))best={gap,target,moved};
   }
   if(best){result[axis==='x'?'dx':'dy']+=best.gap;const aligned={...best.moved,[axis]:best.target[axis]};result.guides=[{a:best.target,b:aligned,component:axis}];result.marker=Math.abs(aligned[other]-best.target[other])<1e-7?best.target:null;result.label=result.marker?best.target.role:'Выравнивание';}
  }else result=snapTranslation(floor,ids,dx,dy,tolerance,{...options,...set});
 }
 if(!result.label&&options.gridSnap&&set.anchors.length){
  const anchor=set.reference||set.anchors[0],step=options.gridStep||.25;
  if(options.onlyAxis!=='y')result.dx=Math.round((anchor.x+dx)/step)*step-anchor.x;
  if(options.onlyAxis!=='x')result.dy=Math.round((anchor.y+dy)/step)*step-anchor.y;
 }
 return result;
}
