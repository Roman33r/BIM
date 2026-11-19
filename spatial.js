import {elementFootprint,elementFrame,normalAngle} from './transforms.js';
import {isPileCap,isRoundStructure,isStructure,rimBoardSegments,screwBladeMesh} from './structures.js';
import {isFastener,fastenerRange} from './hardware.js';
import {verticalRange} from './vertical.js';

export const tiltFields=['tiltX','tiltY'];
export const canTiltElement=e=>['wall','slab','furniture','foundation','framing','fastener'].includes(e.kind);
const radians=angle=>angle*Math.PI/180;

export function setElementTilt(element,axis,value){
 if(!canTiltElement(element)||!tiltFields.includes(axis)||!Number.isFinite(value))throw new Error('Наклон для этого элемента недоступен.');
 const angle=value>=-180&&value<180?value:normalAngle(value);
 if(angle)element[axis]=angle;
 else delete element[axis];
}

export function elementTilts(e,support){
 const tilts=[];
 for(const item of support?[e,support]:[e]){
  if(!item.tiltX&&!item.tiltY)continue;
  const [bottom,top]=verticalRange(item),{center}=elementFrame(item);
  const z=isFastener(item)?item.elevation:isRoundStructure(item)?top:isPileCap(item)?bottom:(bottom+top)/2;
  tilts.push({pivot:{...center,z},x:radians(item.tiltX||0),y:radians(item.tiltY||0)});
 }
 return tilts;
}

export function applyElementTilts(point,tilts){
 for(const {pivot,x,y} of tilts){
  const a=point.x-pivot.x,b=point.y-pivot.y,c=point.z-pivot.z;
  const cy=Math.cos(y),sy=Math.sin(y),cx=Math.cos(x),sx=Math.sin(x),z=b*sx+c*cx;
  point={x:pivot.x+a*cy+z*sy,y:pivot.y+b*cx-c*sx,z:pivot.z-a*sy+z*cy};
 }
 return point;
}

export function convexOutline(points){
 const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);
 const unique=sorted.filter((p,i)=>!i||Math.hypot(p.x-sorted[i-1].x,p.y-sorted[i-1].y)>1e-8);
 if(unique.length<3)return unique;
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const side=ordered=>{
  const result=[];
  for(const p of ordered){
   while(result.length>1&&cross(result.at(-2),result.at(-1),p)<=1e-10)result.pop();
   result.push(p);
  }
  return result.slice(0,-1);
 };
 return [...side(unique),...side(unique.reverse())];
}

export function projectedElement(e,support,members=[]){
 const tilts=elementTilts(e,support);
 if(!tilts.length)return [];
 const [bottom,top]=verticalRange(e);
 const shaft=e.type==='screwPile'?{...e,bladeDiameter:e.diameter}:e;
 const footprint=e.type==='rim'?rimBoardSegments(e,members).flatMap(board=>elementFootprint({...e,...board})):elementFootprint(shaft);
 const prism=footprint.flatMap(p=>[{...p,z:bottom},{...p,z:top}]);
 if(e.type==='screwPile'){
  const {vertices}=screwBladeMesh(e);
  for(let i=0;i<vertices.length;i+=3)prism.push({x:e.x+vertices[i],z:bottom+vertices[i+1],y:e.y+vertices[i+2]});
 }
 return convexOutline(prism.map(p=>applyElementTilts(p,tilts)));
}

export function floorTiltProjections(floor){
 const structures=floor.structures||[],byId=new Map((floor.sourceStructures||structures).map(e=>[e.id,e])),projections=new Map();
 for(const element of [...floor.walls,...floor.slabs,...(floor.furniture||[]),...structures]){
  const outline=projectedElement(element,isPileCap(element)?byId.get(element.pileId):undefined,floor.sourceStructures||structures);
  if(outline.length>1)projections.set(element.id,outline);
 }
 return projections;
}
