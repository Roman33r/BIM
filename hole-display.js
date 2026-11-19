import {capHoles,isRingFastener} from './hardware.js';
import {isPileCap} from './structures.js';
import {componentHoles} from './assembly.js';
import {verticalRange} from './vertical.js';
import {elementTilts,applyElementTilts,convexOutline} from './spatial.js';

// Shared world geometry keeps the dashed bores consistent in all projections.
export function holeVolumes(floor){
 const members=floor.structures||[],source=floor.sourceStructures||members,result=[];
 for(const e of [...members,...floor.slabs]){
  const [bottom,top]=verticalRange(e),holes=isPileCap(e)?capHoles(e).map(p=>({...p,bottom,top})):isRingFastener(e)?[{x:e.x,y:e.y,radius:e.diameter/2,bottom,top}]:componentHoles(e,source);
  const support=isPileCap(e)?source.find(p=>p.id===e.pileId):undefined,tilts=elementTilts(e,support);
  const transform=p=>{const q=applyElementTilts(p,tilts);return {...q,z:q.z+floor.elevation};};
  holes.forEach((h,index)=>{
   const loops=[h.bottom,h.top].map(z=>Array.from({length:32},(_,i)=>transform({x:h.x+h.radius*Math.cos(i*Math.PI/16),y:h.y+h.radius*Math.sin(i*Math.PI/16),z})));
   result.push({owner:e.id,index,loops,axis:[transform({x:h.x,y:h.y,z:h.bottom}),transform({x:h.x,y:h.y,z:h.top})]});
  });
 }
 return result;
}
export function renderHoleXray(floors,view='top',dark=false){
 const project=p=>view==='bottom'?{x:p.x,y:-p.y}:view==='front'?{x:p.x,y:-p.z}:view==='back'?{x:-p.x,y:-p.z}:view==='left'?{x:p.y,y:-p.z}:view==='right'?{x:-p.y,y:-p.z}:{x:p.x,y:p.y};
 return `<g class="hole-xray-overlay" pointer-events="none" fill="none" stroke="${dark?'#7ee4ef':'#087b99'}" stroke-width="1.4" stroke-dasharray="4 3" vector-effect="non-scaling-stroke">${floors.flatMap(holeVolumes).map(h=>{
  const points=convexOutline(h.loops.flat().map(project));
  return `<path data-hole-index="${h.index}" d="M${points.map(p=>`${p.x} ${p.y}`).join('L')}Z" vector-effect="non-scaling-stroke"/>`;
 }).join('')}</g>`;
}
