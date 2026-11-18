import {findElement} from './elements.js';
import {elementAnchors,elementAxes,add,sub,mul,dot,length} from './transforms.js';
import {floorElements,elementVisible} from './selection.js';
export function snapTargets(floor,excludedId,axes=true,options={}){
 const excluded=new Set(Array.isArray(excludedId)?excludedId:[excludedId]), points=[], lines=[];
 for(const {element,host} of floorElements(floor)){
  if(excluded.has(element.id) || excluded.has(host?.id) || !elementVisible(element,options)) continue;
  points.push(...elementAnchors(element,host).map(p=>({...p,id:element.id})));
  if(axes && options.axisTypes?.[element.kind]!==false) lines.push(...elementAxes(element,host).map(a=>({...a,id:element.id})));
 }
 return {points,lines};
}
export function snapPoint(point,targets,tolerance,{alignment=true,axes=true}={}){
 let best=null;for(const target of targets.points){const distance=length(sub(point,target));if(distance<=tolerance&&(!best||distance<best.distance))best={point:{x:target.x,y:target.y},distance,marker:target,label:target.role,guides:[]};}
 if(best)return {...best,guides:alignment?[{a:best.point,b:point,component:'x'},{a:best.point,b:point,component:'y'}]:[]};
 if(axes)for(const axis of targets.lines){const along=dot(sub(point,axis.center),axis.direction);if(Math.abs(along)>axis.extent+tolerance*4)continue;const projected=add(axis.center,mul(axis.direction,along)),distance=length(sub(point,projected));if(distance<=tolerance&&(!best||distance<best.distance))best={point:projected,distance,marker:{...projected,role:'Ось симметрии'},label:'Ось симметрии',guides:[{a:add(axis.center,mul(axis.direction,-axis.extent)),b:add(axis.center,mul(axis.direction,axis.extent)),axis:true}]};}
 if(best)return best;
 const guides=[],snapped={...point};if(alignment){for(const component of ['x','y']){let target=null,gap=tolerance;for(const p of targets.points){const distance=Math.abs(point[component]-p[component]);if(distance<gap){gap=distance;target=p;}}if(target){snapped[component]=target[component];guides.push({a:{...target},b:{...snapped},component});}}}
 return {point:snapped,distance:length(sub(point,snapped)),guides,label:guides.length?'Выравнивание':'',marker:null};
}
export function snapTranslation(floor,id,dx,dy,tolerance,options={}){
 const ids=Array.isArray(id)?id:[id];
 const anchors=options.anchors??ids.flatMap(id=>{
  const item=findElement(floor,id);
  return item?elementAnchors(item.element,item.host):[];
 });
 const targets=options.targets??snapTargets(floor,ids,options.axes,options);
 let pointBest=null,axisBest=null;const align={};
 for(const anchor of anchors){const moved={x:anchor.x+dx,y:anchor.y+dy},result=snapPoint(moved,targets,tolerance,options),correction=sub(result.point,moved);
  if(result.marker){const record={...result,correction,anchor:moved};if(result.label==='Ось симметрии'){if(!axisBest||result.distance<axisBest.distance)axisBest=record;}else if(!pointBest||result.distance<pointBest.distance)pointBest=record;}
  else for(const guide of result.guides){const key=guide.component;if(!align[key]||Math.abs(correction[key])<Math.abs(align[key].correction[key]))align[key]={guide,correction};}
 }
 const best=pointBest||axisBest;if(best)return {dx:dx+best.correction.x,dy:dy+best.correction.y,guides:best.guides.concat(options.alignment===false?[]:[{a:best.anchor,b:best.point}]),marker:best.marker,label:best.label};
 const guides=[];for(const key of ['x','y'])if(align[key]){if(key==='x')dx+=align[key].correction.x;else dy+=align[key].correction.y;guides.push(align[key].guide);}return {dx,dy,guides,marker:null,label:guides.length?'Выравнивание':''};
}
