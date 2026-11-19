import {findElement,translateSelection,detachFixings} from './elements.js';
import {isStructure,isRoundStructure,isPileCap} from './structures.js';
import {capHoleSettings} from './hardware.js';
import {elementAngle,setElementAngle} from './transforms.js';
import {canTiltElement,setElementTilt} from './spatial.js';
import {canMoveVertical,translateVertical} from './vertical.js';
const labels={height:'Высота / длина',thickness:'Толщина / ширина',w:'Ширина',d:'Глубина',width:'Ширина проёма',sill:'Низ проёма',diameter:'Диаметр',bladeDiameter:'Диаметр лопасти',bladeThickness:'Толщина лопасти',bladePitch:'Шаг витка',gauge:'Толщина профиля',headDiameter:'Габарит головки',headHeight:'Высота головки',threadPitch:'Шаг резьбы',ringPitch:'Шаг насечки',holeCount:'Количество отверстий',holeDiameter:'Диаметр отверстия',holeInset:'От края до центра',length:'Длина в плане',elevation:'Верх / отметка установки',baseElevation:'Отметка от этажа',angle:'Поворот Z',tiltX:'Поворот X',tiltY:'Поворот Y'};
function values(item){
 const e=item.element,result={};
 for(const key of Object.keys(labels))if(typeof e[key]==='number')result[key]=e[key];
 if(e.a&&e.mode!=='angle')result.length=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y);
 if(!item.host&&!isRoundStructure(e)&&!(e.kind==='guide'&&e.type==='point')&&e.kind!=='dimension')result.angle=elementAngle(e);
 if(canTiltElement(e)){result.tiltX=e.tiltX||0;result.tiltY=e.tiltY||0;}
 if(!item.host&&canMoveVertical(e)&&!isStructure(e))result.baseElevation=e.baseElevation||0;
 if(isPileCap(e)){const h=capHoleSettings(e);Object.assign(result,{holeCount:h.count,holeDiameter:h.diameter,holeInset:h.inset});if(e.pileId!==undefined)delete result.elevation;}
 return result;
}
export function commonProperties(items){
 if(!items.length)return [];
 const all=items.map(values);
 return Object.keys(labels).filter(k=>all.every(v=>k in v)).map(key=>{
  const degrees=['angle','tiltX','tiltY'].includes(key),count=key==='holeCount',first=all[0][key],mixed=all.some(v=>Math.abs(v[key]-first)>1e-7);
  return {key,label:key==='height'&&items.every(i=>isRoundStructure(i.element))?'Длина свай':labels[key],value:mixed?null:first*(degrees||count?1:1000),unit:degrees?'°':count?'шт.':'мм',scale:degrees||count?1:1000};
 });
}
export function applyBulkProperty(floor,ids,key,value){
 const items=[...ids].map(id=>findElement(floor,id)).filter(Boolean);
 if(['dx','dy','dz'].includes(key)){
  if(!Number.isFinite(value))throw new Error('Введите корректное перемещение.');
  if(key==='dz')translateVertical(floor,ids,value);else translateSelection(floor,ids,key==='dx'?value:0,key==='dy'?value:0);return;
 }
 if(!commonProperties(items).some(f=>f.key===key))throw new Error('Параметр недоступен для всей группы.');
 if(!Number.isFinite(value))throw new Error('Введите корректное число.');
 for(const {element:e} of items){
  if(key==='angle')setElementAngle(floor,e.id,value);
  else if(key==='tiltX'||key==='tiltY'){detachFixings(floor,e.id);setElementTilt(e,key,value);}
  else if(key==='length'){const old=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y);if(value<=0)throw new Error('Длина должна быть положительной.');e.b={x:e.a.x+(e.b.x-e.a.x)*value/old,y:e.a.y+(e.b.y-e.a.y)*value/old};delete e.mounts;}
  else{if(key==='elevation'||key==='baseElevation'){detachFixings(floor,e.id);delete e.mounts;}e[key]=value;}
 }
}
