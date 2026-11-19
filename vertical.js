import {isStructure,isPileCap,linkedPileSelection} from './structures.js';
import {isFastener,fastenerRange} from './hardware.js';
import {findElement,detachFixings,preservedFixings} from './elements.js';

export function verticalRange(e,host){
 if(host)return [verticalRange(host)[0]+e.sill,verticalRange(host)[0]+e.sill+e.height];
 if(isFastener(e))return fastenerRange(e);
 if(isStructure(e))return [e.elevation-e.height,e.elevation];
 const base=e.baseElevation||0;
 if(e.kind==='slab')return [base-e.thickness,base];
 return [base,base+(e.height||0)];
}
export const canMoveVertical=e=>['wall','slab','furniture','foundation','framing','fastener','doorway','door','window'].includes(e.kind);
export function translateVertical(floor,ids,delta){
 if(!Number.isFinite(delta))throw new Error('Некорректное перемещение по высоте.');
 const selected=linkedPileSelection(floor,ids);
 const connections=preservedFixings(floor,selected);
 for(const id of selected){
  const item=findElement(floor,id);if(!item||!canMoveVertical(item.element))continue;
  const {element:e,host}=item;
  detachFixings(floor,id);
  if(host){if(!selected.has(host.id))e.sill+=delta;}
  else if(isPileCap(e)&&e.pileId!==undefined)continue;
  else if(isStructure(e)){if(e.mounts&&!e.mounts.every(m=>selected.has(m.capId)))delete e.mounts;e.elevation+=delta;}
  else e.baseElevation=(e.baseElevation||0)+delta;
 }
 for(const [e,fixings] of connections)e.fixings=fixings;
}
