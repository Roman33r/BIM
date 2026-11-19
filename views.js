import {elementFootprint,elementFrame} from './transforms.js';
import {elementTilts,applyElementTilts,convexOutline} from './spatial.js';
import {verticalRange,canMoveVertical} from './vertical.js';
import {wallBlocks} from './model.js';
import {isPileCap,isRoundStructure,rimBoardSegments} from './structures.js';
import {materialSpec} from './materials.js';
import {capHoles,isRingFastener,isFastener} from './hardware.js';
import {renderHoleXray} from './hole-display.js';
import {componentHoles,pointInside} from './assembly.js';
import {boardMountPoints} from './board-mounts.js';
import {guidePoints,guideDash} from './construction-guides.js';

export const VIEW_PRESETS={top:{name:'Сверху',direction:[0,1,0],up:[0,0,-1]},bottom:{name:'Снизу',direction:[0,-1,0],up:[0,0,1]},front:{name:'Спереди',direction:[0,0,1],up:[0,1,0]},back:{name:'Сзади',direction:[0,0,-1],up:[0,1,0]},left:{name:'Слева',direction:[-1,0,0],up:[0,1,0]},right:{name:'Справа',direction:[1,0,0],up:[0,1,0]}};
export function projectView(p,view){
 if(view==='bottom')return {x:p.x,y:-p.y};
 if(view==='front')return {x:p.x,y:-p.z};
 if(view==='back')return {x:-p.x,y:-p.z};
 if(view==='left')return {x:p.y,y:-p.z};
 if(view==='right')return {x:-p.y,y:-p.z};
 return {x:p.x,y:p.y};
}
export function viewDelta(dx,dy,view){
 if(view==='bottom')return {x:dx,y:-dy,z:0};
 if(view==='front'||view==='back')return {x:dx*(view==='front'?1:-1),y:0,z:-dy};
 if(view==='left'||view==='right')return {x:0,y:dx*(view==='left'?1:-1),z:-dy};
 return {x:dx,y:dy,z:0};
}
export function unprojectView(p,view,depth=0){
 if(view==='bottom')return {x:p.x,y:-p.y,z:depth};
 if(view==='front')return {x:p.x,y:depth,z:-p.y};
 if(view==='back')return {x:-p.x,y:depth,z:-p.y};
 if(view==='left')return {x:depth,y:p.x,z:-p.y};
 if(view==='right')return {x:depth,y:-p.x,z:-p.y};
 return {x:p.x,y:p.y,z:depth};
}
export function feedbackForView(feedback,view){
 if(!feedback.plane){
  if(view==='top')return feedback;
  if(view==='bottom'){const mirror=p=>({...p,y:-p.y});return {...feedback,guides:(feedback.guides||[]).map(g=>({...g,a:mirror(g.a),b:mirror(g.b)})),marker:feedback.marker?mirror(feedback.marker):null};}
  return {};
 }
 if(feedback.plane.view===view)return feedback;
 const convert=p=>projectView(unprojectView(p,feedback.plane.view,feedback.plane.depth),view);
 return {...feedback,guides:(feedback.guides||[]).map(g=>({...g,a:convert(g.a),b:convert(g.b),component:undefined})),marker:feedback.marker?convert(feedback.marker):null};
}
export function cameraStep(keys,angle,delta,speed){
 let forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),right=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),up=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
 const norm=Math.hypot(forward,right,up)||1,factor=Math.min(.05,Math.max(0,delta))*speed/norm;
 return {x:(-Math.sin(angle)*forward+Math.cos(angle)*right)*factor,y:up*factor,z:(-Math.cos(angle)*forward-Math.sin(angle)*right)*factor};
}
export function projectedElementAxes(floor,e,view,host){
 const [bottom,top]=verticalRange(e,host),support=host||(e.type==='pileCap'?floor.structures.find(p=>p.id===e.pileId):null),tilts=elementTilts(e,support),frame=elementFrame(e,host),mid=(bottom+top)/2;
 const project=(p,z)=>{const world=applyElementTilts({...p,z},tilts);return projectView({...world,z:world.z+floor.elevation},view);},center=project(frame.center,mid),axes=[];
 for(const [p,z,extent] of [[{x:frame.center.x+frame.u.x,y:frame.center.y+frame.u.y},mid,frame.w/2+.3],[{x:frame.center.x+frame.v.x,y:frame.center.y+frame.v.y},mid,frame.h/2+.3],[frame.center,mid+1,(top-bottom)/2+.3]]){
  const end=project(p,z),dx=end.x-center.x,dy=end.y-center.y,length=Math.hypot(dx,dy);
  if(length>1e-7)axes.push({center,direction:{x:dx/length,y:dy/length},extent:extent*length,id:e.id});
 }
 return axes;
}
export function projectedElements(floor,view){
 const members=floor.structures||[],items=[...floor.walls,...floor.slabs,...floor.furniture,...members].map(element=>({element}));
 for(const wall of floor.walls)for(const element of wall.openings)items.push({element,host:wall});
 return items.filter(({element})=>canMoveVertical(element)).map(({element:e,host})=>{
  const support=host||(isPileCap(e)?members.find(p=>p.id===e.pileId):null),tilts=elementTilts(e,support),parts=[];
  const add=(footprint,bottom,top)=>parts.push(convexOutline(footprint.flatMap(p=>[bottom,top].map(z=>{
   const tilted=applyElementTilts({...p,z},tilts);return projectView({...tilted,z:tilted.z+floor.elevation},view);
  }))));
  const [bottom,top]=verticalRange(e,host);
  if(e.kind==='wall'){
   const length=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),ux=(e.b.x-e.a.x)/length,uy=(e.b.y-e.a.y)/length;
   for(const block of wallBlocks(e,e.height)){
    const a={x:e.a.x+ux*block.start,y:e.a.y+uy*block.start},b={x:e.a.x+ux*block.end,y:e.a.y+uy*block.end};
    add(elementFootprint({...e,a,b}),bottom+block.bottom,bottom+block.top);
   }
  }else if(isFastener(e)){
   const circle=diameter=>Array.from({length:24},(_,i)=>({x:e.x+diameter/2*Math.cos(i*Math.PI/12),y:e.y+diameter/2*Math.sin(i*Math.PI/12)}));
   if(isRingFastener(e))add(circle(e.headDiameter),bottom,top);
   else{add(circle(e.diameter),bottom,e.elevation);add(circle(e.headDiameter),e.elevation,top);}
  }else if(e.type==='rim')for(const board of rimBoardSegments(e,members))add(elementFootprint({...e,...board}),bottom,top);
  else if(isRoundStructure(e)){
   const circle=(diameter)=>Array.from({length:24},(_,i)=>({x:e.x+diameter/2*Math.cos(i*Math.PI/12),y:e.y+diameter/2*Math.sin(i*Math.PI/12)}));
   add(circle(e.diameter),bottom,top);
   if(e.type==='screwPile')add(circle(e.bladeDiameter),bottom+e.diameter,bottom+e.diameter+e.bladePitch);
  }else add(elementFootprint(e,host),bottom,top);
  return {element:e,parts:parts.filter(p=>p.length>=3),depth:view==='bottom'?top:view==='front'?-(e.y??e.a?.y??0):view==='back'?(e.y??e.a?.y??0):view==='left'?(e.x??e.a?.x??0):-(e.x??e.a?.x??0)};
 }).sort((a,b)=>b.depth-a.depth);
}
export function orthographicBounds(floors,view){
 const points=floors.flatMap(f=>projectedElements(f,view).flatMap(e=>e.parts.flat()));
 if(!points.length)return {x:-2,y:-2,w:4,h:4};
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs)-.4,y=Math.min(...ys)-.4;
 return {x,y,w:Math.max(1,Math.max(...xs)-x+.4),h:Math.max(1,Math.max(...ys)-y+.4)};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function renderOrthographic(floors,view,{selectedIds=new Set(),unit=.02,dark=false,grid=true,gridStep=.25,textures=true,holeXray=false,feedback={},bounds={x:-100,y:-100,w:200,h:200},axes=false,axisTypes}={}){
 let svg=`<defs><pattern id="elevation-grid" width="${gridStep}" height="${gridStep}" patternUnits="userSpaceOnUse"><path d="M${gridStep} 0H0V${gridStep}" stroke="${dark?'#405064':'#cdd5e0'}" fill="none" stroke-width=".7" vector-effect="non-scaling-stroke"/></pattern></defs>`;
 if(grid)svg+='<rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#elevation-grid)"/>';
 for(const floor of floors)for(const {element:e,parts} of projectedElements(floor,view)){
  const selected=selectedIds.has(e.id),spec=materialSpec(e.material||'Дерево'),fill=selected?'#9cbaff':textures?(dark?spec.dark:spec.base):'#fff';
  const attrs=`fill="${fill}" stroke="${selected?'#2164ff':dark?'#bbc8d9':'#667282'}" stroke-width="${selected?2:1}" vector-effect="non-scaling-stroke"`;
  const holes=view==='bottom'?(isPileCap(e)?capHoles(e):e.drillHoles?.length||e.type==='rimBoard'?componentHoles(e,floor.structures).filter(h=>Math.abs(h.bottom-verticalRange(e)[0])<1e-6):isRingFastener(e)?[{x:e.x,y:e.y,radius:e.diameter/2}]:[]):[];
  const voids=points=>holes.filter(p=>pointInside({x:p.x,y:-p.y},points,p.radius*.999)).map(p=>`M${p.x+p.radius} ${-p.y}a${p.radius} ${p.radius} 0 1 0 ${-2*p.radius} 0a${p.radius} ${p.radius} 0 1 0 ${2*p.radius} 0Z`).join('');
  svg+=`<g data-element="${esc(e.id)}" class="orthographic-element" data-kind="${e.kind}">${parts.map(points=>holes.length?`<path d="M${points.map(p=>`${p.x} ${p.y}`).join('L')}Z${voids(points)}" fill-rule="evenodd" ${attrs}/>`:`<polygon points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" ${attrs}/>`).join('')}</g>`;
 }
 for(const floor of floors)for(const guide of floor.construction||[]){
  const points=guidePoints(guide).map(p=>projectView({...p,z:floor.elevation},view));if(!points.length)continue;
  svg+=`<g class="projection-guide" pointer-events="none" fill="none" stroke="#bb7c31" stroke-width="1.2" vector-effect="non-scaling-stroke">${guide.type==='point'||Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y)<1e-8?`<circle cx="${points[0].x}" cy="${points[0].y}" r="${3*unit}"/>`:`<polyline points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" stroke-dasharray="${guideDash(guide.style)}"/>`}</g>`;
 }
 if(axes)for(const floor of floors)for(const {element:e,parts} of projectedElements(floor,view)){
  if(e.showAxes===false||axisTypes?.[e.kind]===false||!parts.length)continue;
  const host=floor.walls.find(w=>w.openings.some(o=>o.id===e.id));
  for(const {center:c,direction:d,extent} of projectedElementAxes(floor,e,view,host))svg+=`<path d="M${c.x-d.x*extent} ${c.y-d.y*extent}L${c.x+d.x*extent} ${c.y+d.y*extent}" class="symmetry-axis" pointer-events="none"/>`;
 }
 if(holeXray)svg+=renderHoleXray(floors,view,dark);
 const shown=feedbackForView(feedback,view);
 for(const guide of shown.guides||[]){let {a,b}=guide;
  if(guide.component==='x'){a={x:a.x,y:bounds.y};b={x:a.x,y:bounds.y+bounds.h};}
  if(guide.component==='y'){a={x:bounds.x,y:a.y};b={x:bounds.x+bounds.w,y:a.y};}
  svg+=`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" class="alignment-guide${guide.axis?' axis-guide':''}" pointer-events="none"/>`;
 }
 if(shown.marker)svg+=`<g pointer-events="none" class="projected-snap-marker" data-snap-type="${esc(shown.label||'Привязка')}"><circle cx="${shown.marker.x}" cy="${shown.marker.y}" r="${5*unit}" fill="none" stroke="#087f76" stroke-width="2" vector-effect="non-scaling-stroke"/><text x="${shown.marker.x+9*unit}" y="${shown.marker.y-9*unit}" font-size="${11*unit}" fill="${dark?'#80e1d6':'#087f76'}">${esc(shown.label||'Привязка')}</text></g>`;
 return svg;
}
export function selectOrthographic(floor,view,rect){
 return projectedElements(floor,view).filter(({parts})=>{
  const points=parts.flat();if(!points.length)return false;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  return rect.crossing?left<=rect.right&&right>=rect.left&&top<=rect.bottom&&bottom>=rect.top:left>=rect.left&&right<=rect.right&&top>=rect.top&&bottom<=rect.bottom;
 }).map(({element})=>element.id);
}
export function exportOrthographic(floors,view,options={}){
 const bounds=orthographicBounds(floors,view);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${Math.round(1200*bounds.h/bounds.w)}" viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}"><title>${VIEW_PRESETS[view].name}</title>${renderOrthographic(floors,view,{...options,grid:false,selectedIds:new Set(),feedback:{},axes:false})}</svg>`;
}
