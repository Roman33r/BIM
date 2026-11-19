import {elementFrame, elementFootprint, add, mul} from './transforms.js';
import {isElementShown} from './visibility.js';
import {angleGeometry} from './annotations.js';
import {FLOOR_COLLECTIONS} from './elements.js';
import {floorTiltProjections} from './spatial.js';

export const AXIS_TYPES = Object.freeze({
 wall:'Стены', doorway:'Дверные проёмы', door:'Двери', window:'Окна', slab:'Перекрытия',
 furniture:'Мебель и оборудование', room:'Помещения', dimension:'Размеры', foundation:'Фундаменты', framing:'Каркас перекрытия',fastener:'Крепёж'
});

export function* floorElements(floor) {
 for (const wall of floor.walls) {
  if(!isElementShown(floor,wall))continue;
  yield {element:wall};
  for (const element of wall.openings)if(isElementShown(floor,element,wall))yield {element, host:wall};
 }
 for (const collection of FLOOR_COLLECTIONS.slice(1)) {
  for (const element of floor[collection]||[])if(isElementShown(floor,element))yield {element};
 }
}
export function extendSelection(event){return event.ctrlKey||event.metaKey||event.shiftKey;}

export function elementVisible(element, options) {
 return !element.hidden && (element.kind !== 'room' || options.labels !== false)
  && (element.kind !== 'dimension' || options.dimensions !== false);
}

export function* axisElements(floor, options) {
 for (const item of floorElements(floor)) {
  const {element} = item;
  if (elementVisible(element, options) && options.axisTypes?.[element.kind] !== false && element.showAxes !== false) yield item;
 }
}

export function selectionBounds(start, end) {
 return {left:Math.min(start.x,end.x), right:Math.max(start.x,end.x),
  top:Math.min(start.y,end.y), bottom:Math.max(start.y,end.y), crossing:end.x < start.x};
}

function segmentsTouch(a, b, c, d) {
 const cross = (p,q,r) => (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 const between = (x,p,q) => x >= Math.min(p,q)-1e-9 && x <= Math.max(p,q)+1e-9;
 const on = (p,q,r) => Math.abs(cross(p,q,r)) < 1e-9 && between(r.x,p.x,q.x) && between(r.y,p.y,q.y);
 return cross(a,b,c)*cross(a,b,d) < 0 && cross(c,d,a)*cross(c,d,b) < 0
  || on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b);
}

function insidePolygon(point, polygon) {
 let inside = false;
 for (let i=0,j=polygon.length-1; i<polygon.length; j=i++) {
  const a=polygon[i], b=polygon[j];
  if ((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
 }
 return inside;
}

function matchesOutline(points, box) {
 const contains = p => p.x>=box.left && p.x<=box.right && p.y>=box.top && p.y<=box.bottom;
 if (!box.crossing) return points.every(contains);
 if (points.some(contains)) return true;
 const corners = [{x:box.left,y:box.top},{x:box.right,y:box.top},{x:box.right,y:box.bottom},{x:box.left,y:box.bottom}];
 return (points.length>2 && corners.some(p=>insidePolygon(p,points)))
  || points.some((a,i)=>corners.some((c,j)=>segmentsTouch(a,points[(i+1)%points.length],c,corners[(j+1)%4])));
}

function outline(element, host) {
 if (element.mode==='angle') {
  const {rays,arc}=angleGeometry(element);
  return [rays[1],rays[0],...arc,rays[2]];
 }
 if (element.kind==='dimension') {
  const frame = elementFrame(element,host);
  const offset = mul(frame.v,element.offset);
  return [element.a,element.b,add(element.b,offset),add(element.a,offset)];
 }
 return elementFootprint(element,host);
}

export function selectInPlan(floor, box, options={}) {
 const ids=[],projections=floorTiltProjections(floor);
 for (const {element,host} of floorElements(floor)) {
  if(!elementVisible(element,options))continue;
  const projected=projections.get(element.id);
  if(matchesOutline(outline(element,host),box)||projected&&matchesOutline(projected,box))ids.push(element.id);
 }
 return ids;
}

export function showSelectionBox(node, box, viewport) {
 node.hidden = !box;
 if (!box) return;
 const left = Math.max(0,box.left-viewport.left), top = Math.max(0,box.top-viewport.top);
 node.style.left = left+'px';
 node.style.top = top+'px';
 node.style.width = Math.max(0,Math.min(viewport.width,box.right-viewport.left)-left)+'px';
 node.style.height = Math.max(0,Math.min(viewport.height,box.bottom-viewport.top)-top)+'px';
 node.classList.toggle('crossing',box.crossing);
}
