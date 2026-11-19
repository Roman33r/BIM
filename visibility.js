import {FLOOR_COLLECTIONS,listElements} from './elements.js';
export const ELEMENT_GROUPS={wall:'Стены',doorway:'Дверные проёмы',door:'Двери',window:'Окна',slab:'Перекрытия',foundation:'Фундаменты и сваи',framing:'Балки и каркас',fastener:'Крепёж',furniture:'Мебель и оборудование',room:'Помещения',dimension:'Размеры',guide:'Вспомогательная геометрия'};
export function isElementShown(floor,element,host){return !floor.hidden&&!element.hidden&&!floor.hiddenKinds?.includes(element.kind)&&(!host||isElementShown(floor,host));}
export function visibleFloor(floor){
 const result={...floor,sourceStructures:floor.sourceStructures||floor.structures};
 for(const key of FLOOR_COLLECTIONS)result[key]=(floor[key]||[]).filter(e=>isElementShown(floor,e));
 result.walls=result.walls.map(w=>({...w,openings:w.openings.map(e=>isElementShown(floor,e,w)?e:{...e,hidden:true})}));
 return result;
}
export function setGroupVisibility(floor,kind,visible){floor.hiddenKinds=[...(floor.hiddenKinds||[]).filter(k=>k!==kind),...(visible?[]:[kind])];}
export function validateVisibility(floor){
 if(floor.hidden!==undefined&&typeof floor.hidden!=='boolean'||floor.hiddenKinds!==undefined&&(!Array.isArray(floor.hiddenKinds)||floor.hiddenKinds.length>Object.keys(ELEMENT_GROUPS).length||floor.hiddenKinds.some(k=>!Object.hasOwn(ELEMENT_GROUPS,k))))throw new Error('Некорректные настройки видимости этажа.');
 for(const e of listElements(floor))if(e.hidden!==undefined&&typeof e.hidden!=='boolean')throw new Error('Некорректная видимость элемента.');
}
