import {elementFootprint} from './transforms.js';
import {elementTilts,applyElementTilts,convexOutline} from './spatial.js';
import {verticalRange,canMoveVertical} from './vertical.js';
import {wallBlocks} from './model.js';
import {isPileCap,isRoundStructure,rimBoardSegments} from './structures.js';
import {materialSpec} from './materials.js';
import {capHoles,isRingFastener,isFastener} from './hardware.js';
import {boardMountPoints} from './board-mounts.js';

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
export function cameraStep(keys,angle,delta,speed){
 let forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),right=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),up=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
 const norm=Math.hypot(forward,right,up)||1,factor=Math.min(.05,Math.max(0,delta))*speed/norm;
 return {x:(-Math.sin(angle)*forward+Math.cos(angle)*right)*factor,y:up*factor,z:(-Math.cos(angle)*forward-Math.sin(angle)*right)*factor};
}
export function projectedElements(floor,view){
 const members=floor.structures||[],items=[...floor.walls,...floor.slabs,...floor.furniture,...members].map(element=>({element}));
 for(const wall of floor.walls)for(const element of wall.openings)items.push({element,host:wall});
 return items.filter(({element})=>canMoveVertical(element)).map(({element:e,host})=>{
  const support=isPileCap(e)?members.find(p=>p.id===e.pileId):null,tilts=elementTilts(e,support),parts=[];
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
export function renderOrthographic(floors,view,{selectedIds=new Set(),unit=.02,dark=false,grid=true,gridStep=.25,textures=true}={}){
 let svg=`<defs><pattern id="elevation-grid" width="${gridStep}" height="${gridStep}" patternUnits="userSpaceOnUse"><path d="M${gridStep} 0H0V${gridStep}" stroke="${dark?'#405064':'#cdd5e0'}" fill="none" stroke-width=".7" vector-effect="non-scaling-stroke"/></pattern></defs>`;
 if(grid)svg+='<rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#elevation-grid)"/>';
 for(const floor of floors)for(const {element:e,parts} of projectedElements(floor,view)){
  const selected=selectedIds.has(e.id),spec=materialSpec(e.material||'Дерево'),fill=selected?'#9cbaff':textures?(dark?spec.dark:spec.base):'#fff';
  const attrs=`fill="${fill}" stroke="${selected?'#2164ff':dark?'#bbc8d9':'#667282'}" stroke-width="${selected?2:1}" vector-effect="non-scaling-stroke"`;
  const holes=view==='bottom'?(isPileCap(e)?capHoles(e):e.type==='rimBoard'?boardMountPoints(e,floor.structures).map(m=>m.point):isRingFastener(e)?[{x:e.x,y:e.y,radius:e.diameter/2}]:[]):[];
  const voids=holes.map(p=>`M${p.x+p.radius} ${-p.y}a${p.radius} ${p.radius} 0 1 0 ${-2*p.radius} 0a${p.radius} ${p.radius} 0 1 0 ${2*p.radius} 0Z`).join('');
  svg+=`<g data-element="${esc(e.id)}" class="orthographic-element" data-kind="${e.kind}">${parts.map(points=>holes.length?`<path d="M${points.map(p=>`${p.x} ${p.y}`).join('L')}Z${voids}" fill-rule="evenodd" ${attrs}/>`:`<polygon points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" ${attrs}/>`).join('')}</g>`;
 }
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
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${Math.round(1200*bounds.h/bounds.w)}" viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}"><title>${VIEW_PRESETS[view].name}</title>${renderOrthographic(floors,view,{...options,grid:false,selectedIds:new Set()})}</svg>`;
}
