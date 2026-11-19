import {openingSpan,wallLength,wallSegments} from './model.js';
import {furniturePlan} from './furniture-plan.js';
import {editorOverlay} from './editor-overlay.js';
import {elementFrame,elementFootprint,framePoint,dot,sub} from './transforms.js';
import {angleGeometry,angleLabel,angleRadius} from './annotations.js';
import {hiddenWallEnds} from './wall-overlaps.js';
import {materialPatterns,materialSpec} from './materials.js';
import {isPileCap,isRoundStructure,pileFootprintDiameter} from './structures.js';
import {segmentMeasurement} from './measurements.js';
import {floorTiltProjections} from './spatial.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const n=value=>Number(value.toFixed(4));
const path=(d,attrs='')=>`<path d="${d}" ${attrs}/>`;
const rect=(x,y,w,h,attrs='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attrs}/>`;
const text=(x,y,value,attrs='')=>`<text x="${n(x)}" y="${n(y)}" ${attrs}>${esc(value)}</text>`;
function dimension(a,b,offset=0.6){
 const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);if(!l)return '';
 const px=-dy/l,py=dx/l,x1=a.x+px*offset,y1=a.y+py*offset,x2=b.x+px*offset,y2=b.y+py*offset;
 return `<g fill="none" stroke="var(--plan-dimension)" stroke-width=".012">${path(`M${n(a.x+px*0.12)} ${n(a.y+py*0.12)}L${n(x1+px*.14)} ${n(y1+py*.14)}M${n(b.x+px*.12)} ${n(b.y+py*.12)}L${n(x2+px*.14)} ${n(y2+py*.14)}M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`)}${[a,b].map(p=>path(`M${n(p.x+px*offset-.065)} ${n(p.y+py*offset+.09)}l.13 -.18`)).join('')}</g>${text((x1+x2)/2+px*.12,(y1+y2)/2+py*.12,Math.round(l*1000).toLocaleString('ru-RU'),`fill="var(--plan-text)" font-size=".19" text-anchor="middle" transform="rotate(${n(Math.atan2(dy,dx)*180/Math.PI)} ${n((x1+x2)/2+px*.12)} ${n((y1+y2)/2+py*.12)})"`)}`;
}
const coords=points=>points.map(p=>`${n(p.x)},${n(p.y)}`).join(' ');
const trace=(points,attrs='')=>`<polyline points="${coords(points)}" ${attrs}/>`;
function structureShape(element,attrs=''){
 if(isRoundStructure(element))return `<circle cx="${n(element.x)}" cy="${n(element.y)}" r="${n(pileFootprintDiameter(element)/2)}" ${attrs}/>`;
 return `<polygon points="${coords(elementFootprint(element))}" ${attrs}/>`;
}
function structurePlan(element,selected,fill,dark){
 const foundation=element.kind==='foundation',stroke=selected?'#2164ff':dark?'#b8c9dd':'#54677c';
 const attrs=`fill="${fill}" fill-opacity="${foundation&&!selected?.72:1}" stroke="${stroke}" stroke-width="${selected?1.9:1.2}"`
  +(foundation?' stroke-dasharray="5 3"':'')+' vector-effect="non-scaling-stroke"';
 let geometry=element.type==='screwPile'
  ?structureShape(element,`fill="transparent" stroke="${stroke}" stroke-dasharray="4 3" stroke-width="${selected?1.9:1.2}" vector-effect="non-scaling-stroke"`)
   +`<circle cx="${n(element.x)}" cy="${n(element.y)}" r="${n(element.diameter/2)}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`
  :structureShape(element,attrs);
 if(element.a&&element.thickness<.15){
  geometry+=trace([element.a,element.b],'stroke="transparent" fill="none" stroke-width="9" vector-effect="non-scaling-stroke"');
 }
 return `<g data-element="${esc(element.id)}" data-structure-type="${element.type}" class="movable-element">${geometry}</g>`;
}
function angularDimension(d,interactive){
 const {rays,arc,label,value}=angleGeometry(d);
 const lines=trace(rays)+trace(arc);
 return `<g fill="none" stroke="var(--plan-dimension)" stroke-width=".024">${lines}</g>`
  +text(label.x,label.y,angleLabel(value),'class="angle-label" fill="var(--plan-text)" font-size=".22" text-anchor="middle" dominant-baseline="middle"')
  +(interactive?`<g fill="none" stroke="transparent" stroke-width=".2">${lines}</g>`:'');
}
function measurementOverlay({a,b},unit,dark){
 const length=segmentMeasurement(a,b).distance;
 if(length<1e-8)return '';
 const color=dark?'#63d3c7':'#087f76',dot=p=>`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(4*unit)}" fill="${color}" stroke="var(--canvas,#fff)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
 const distance=Math.round(length*1000).toLocaleString('ru-RU')+' мм';
 return `<g class="ruler-measurement" pointer-events="none" fill="none">
  ${trace([a,{x:b.x,y:a.y},b],`stroke="${color}" stroke-dasharray="4 4" stroke-width="1" opacity=".65" vector-effect="non-scaling-stroke"`)}
  ${trace([a,b],`stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"`)}
  ${dot(a)}${dot(b)}
  ${text((a.x+b.x)/2,(a.y+b.y)/2-11*unit,distance,`class="editor-measure" fill="${color}" font-size="${12*unit}" text-anchor="middle"`)}
 </g>`;
}
function floorReference(floor,color){
 const close=points=>trace([...points,points[0]]);
 let outlines=floor.slabs.map(slab=>close(slab.points)).join('')+(floor.structures||[]).map(e=>structureShape(e)).join('');
 for(const wall of floor.walls){
  const frame=elementFrame(wall);
  for(const [start,end] of wallSegments(wall))outlines+=close([[start,0],[end,0],[end,frame.h],[start,frame.h]].map(([x,y])=>framePoint(frame,x,y)));
 }
 for(const element of floor.furniture){
  const f=elementFrame(element);
  outlines+=close([[0,0],[f.w,0],[f.w,f.h],[0,f.h]].map(([x,y])=>framePoint(f,x,y)));
 }
 for(const contour of floorTiltProjections(floor).values())outlines+=close(contour);
 return `<g class="reference-floor" data-reference-floor="${esc(floor.id)}" pointer-events="none" stroke="${color}" fill="none" stroke-width=".026" stroke-dasharray=".08 .07" opacity=".65">${outlines}</g>`;
}
export function renderPlan(floor,{selectedId,selectedIds=new Set(selectedId?[selectedId]:[]),grid=true,labels=true,dimensions=true,dark=false,textures=true,draft=[],angleDraft,structurePreview,measurement,referenceFloors=[],interactive=false,axes=false,axisTypes,unit=.02,feedback={},bounds}={}){
 const colors=dark?{'--plan-text':'#dce5f2','--plan-dimension':'#778799','--wall-fill':'#737d8d','--wall-line':'#9ca9bc','--furniture-stroke':'#8794a6','--furniture-fill':'#2b3441','--plant-fill':'#394b40','--plant-stroke':'#758f7c'}:{'--plan-text':'#313b48','--plan-dimension':'#9ba3ae','--wall-fill':'#7f848c','--wall-line':'#525b67','--furniture-stroke':'#939b9f','--furniture-fill':'#fafbf9','--plant-fill':'#f0f5ee','--plant-stroke':'#a0b19c'};
 if(!textures){
  colors['--furniture-fill']='#fff';colors['--plant-fill']='#fff';
  colors['--wall-line']='#667282';
 }
 const tilePattern=textures?`<pattern id="tiles" width=".28" height=".28" patternUnits="userSpaceOnUse"><path d="M.28 0H0V.28" fill="none" stroke="${dark?'#3c4652':'#e1e5e7'}" stroke-width=".012"/></pattern>`+materialPatterns(dark):'';
 const defs=`<defs><pattern id="dots" width=".25" height=".25" patternUnits="userSpaceOnUse"><circle cx=".02" cy=".02" r=".009" fill="${dark?'#3e4857':'#dce2eb'}"/></pattern>${tilePattern}</defs>`;
 const surfaceFill=material=>textures?`url(#material-${materialSpec(material).id})`:'#fff';
 let content=grid?rect(-100,-100,200,200,'fill="url(#dots)"'):'';
 for(const slab of floor.slabs)content+=`<polygon points="${coords(slab.points)}" fill="${surfaceFill(slab.material)}" fill-opacity="${textures?(dark?.28:.24):1}" stroke="${selectedIds.has(slab.id)?'#2164ff':dark?'#526071':'#b5bec8'}" stroke-width="${selectedIds.has(slab.id)?.045:.015}" data-element="${esc(slab.id)}" class="movable-element"/>`;
 for(const reference of referenceFloors)content+=floorReference(reference,reference.elevation>=floor.elevation?(dark?'#7ca6e7':'#678acc'):(dark?'#c49bd5':'#a16eb8'));
 const structures=floor.structures||[];
 for(const e of structures)if(e.kind==='foundation'&&!isPileCap(e))content+=structurePlan(e,selectedIds.has(e.id),surfaceFill(e.material),dark);
 for(const e of structures)if(isPileCap(e))content+=structurePlan(e,selectedIds.has(e.id),surfaceFill(e.material),dark);
 for(const room of floor.rooms){const transform=`transform="translate(${room.x} ${room.y}) rotate(${room.rotation||0})"`;if(textures&&room.name==='Санузел')content+=rect(0,0,room.w,room.h,`${transform} fill="url(#tiles)" pointer-events="none"`);if(selectedIds.has(room.id))content+=rect(0,0,room.w,room.h,`${transform} fill="#2164ff0b" stroke="#2164ff" stroke-width=".025" stroke-dasharray=".1 .06" pointer-events="none"`);}
 content+=furniturePlan(floor.furniture,selectedIds);
 const hidden=hiddenWallEnds(floor.walls), hiddenByWall=new Map();
 for(const end of hidden)hiddenByWall.set(end.id,[...(hiddenByWall.get(end.id)||[]),...end.strokes]);
 for(const [index,wall] of floor.walls.entries()){
  const l=wallLength(wall),angle=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x)*180/Math.PI,selected=selectedIds.has(wall.id);
  content+=`<g transform="translate(${wall.a.x} ${wall.a.y}) rotate(${angle})" data-element="${esc(wall.id)}" class="movable-element">`;
  content+=rect(0,-Math.max(.15,wall.thickness/2),l,Math.max(.3,wall.thickness),'fill="transparent" stroke="none"');
  const segments=wallSegments(wall),fill=surfaceFill(wall.material);
  const segmentRects=attrs=>segments.map(([start,end])=>rect(start,-wall.thickness/2,end-start,wall.thickness,attrs)).join('');
  content+=segmentRects(`fill="${fill}"`);
  if(selected)content+=segmentRects('fill="#2164ff" fill-opacity=".22" pointer-events="none"');
  const stroke=`fill="none" stroke="${selected?'#2164ff':'var(--wall-line)'}" stroke-width="${selected?.035:.018}"`;
  const covered=hiddenByWall.get(wall.id);
  if(covered){
   const f=elementFrame(wall),local=p=>({x:dot(sub(p,wall.a),f.u),y:dot(sub(p,wall.a),f.v)}),mask=`wall-end-${index}`;
   content+=`<mask id="${mask}" maskUnits="userSpaceOnUse" x="-.1" y="${-wall.thickness}" width="${l+.2}" height="${2*wall.thickness}">${rect(-.1,-wall.thickness,l+.2,2*wall.thickness,'fill="white"')}${covered.map(points=>trace(points.map(local),'stroke="black" stroke-width=".06"')).join('')}</mask><g mask="url(#${mask})">${segmentRects(stroke)}</g>`;
  }else content+=segmentRects(stroke);
  for(const o of wall.openings){
   const [x]=openingSpan(o),sel=selectedIds.has(o.id),hitHeight=Math.max(.3,wall.thickness);
   content+=`<g data-element="${esc(o.id)}" data-opening-kind="${o.kind}" stroke="${sel?'#2164ff':'var(--furniture-stroke)'}" stroke-width="${sel?.035:.016}" fill="none">${rect(x,-hitHeight/2,o.width,hitHeight,'fill="transparent" stroke="none"')}`;
   if(o.kind==='window')content+=path(`M${n(x)} -.045h${n(o.width)}M${n(x)} .045h${n(o.width)}`);
   if(o.kind==='door')content+=path(`M${n(x)} 0v${n(o.width)}M${n(x)} ${n(o.width)}A${n(o.width)} ${n(o.width)} 0 0 0 ${n(x+o.width)} 0`);
   if(o.kind==='doorway'&&sel)content+=rect(x,-wall.thickness/2,o.width,wall.thickness,'stroke-dasharray=".09 .06" pointer-events="none"');
   content+='</g>';
  }
  content+='</g>';
 }
 for(const end of hidden)content+=`<g class="hidden-wall-end" data-hidden-wall="${esc(end.id)}" fill="none" stroke="${dark?'#e6e9f0':'#263751'}" stroke-dasharray="3 2" stroke-width="1.1" pointer-events="none">${end.strokes.map(points=>trace(points,'vector-effect="non-scaling-stroke"')).join('')}</g>`;
 for(const e of structures)if(e.kind==='framing')content+=structurePlan(e,selectedIds.has(e.id),surfaceFill(e.material),dark);
 for(const [id,contour] of floorTiltProjections(floor)){
  const stroke=selectedIds.has(id)?(dark?'#bfa6ff':'#6442ae'):(dark?'#a69ac2':'#786789');
  const outline=[...contour,contour[0]];
  content+=`<g class="tilt-projection movable-element" data-element="${esc(id)}" fill="none">
   ${trace(outline,`stroke="${stroke}" stroke-width="${selectedIds.has(id)?2:1.3}" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"`)}
   ${interactive?trace(outline,'stroke="transparent" stroke-width="6" vector-effect="non-scaling-stroke" pointer-events="stroke"'):''}
  </g>`;
 }
 if(labels)for(const r of floor.rooms){const {center:{x,y}}=elementFrame(r);content+=`<g fill="${selectedIds.has(r.id)?'#2164ff':'var(--plan-text)'}" text-anchor="middle" data-element="${esc(r.id)}" class="movable-element">${rect(x-1,y-.25,2,.65,'fill="transparent"')}${text(x,y,r.name,'font-size=".205" font-weight="550"')}${text(x,y+.29,`${(r.w*r.h).toLocaleString('ru-RU',{maximumFractionDigits:1})} м²`,'font-size=".175"')}</g>`;}
 if(dimensions)for(const d of floor.dimensions){
  content+=`<g data-element="${esc(d.id)}" class="movable-element" ${selectedIds.has(d.id)?'style="--plan-text:#2164ff;--plan-dimension:#2164ff"':''}>`;
  if(d.mode==='angle')content+=angularDimension(d,interactive);
  else{
   const dx=d.b.x-d.a.x,dy=d.b.y-d.a.y,l=Math.hypot(dx,dy)||1,px=-dy/l*d.offset,py=dx/l*d.offset;
   content+=dimension(d.a,d.b,d.offset)+`<path d="M${n(d.a.x+px)} ${n(d.a.y+py)}L${n(d.b.x+px)} ${n(d.b.y+py)}" stroke="transparent" stroke-width=".22"/>`;
  }
  content+='</g>';
 }
 if(draft.length)content+=`<polyline points="${draft.map(p=>`${p.x},${p.y}`).join(' ')}" stroke="#2164ff" fill="#2164ff0c" stroke-width=".035" stroke-dasharray=".1 .08" pointer-events="none"/>${draft.map(p=>`<circle cx="${p.x}" cy="${p.y}" r=".055" fill="#2164ff"/>`).join('')}`;
 if(structurePreview)content+=structureShape(structurePreview,'fill="#2164ff" fill-opacity=".12" stroke="#2164ff" stroke-width="1.3" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" pointer-events="none"');
 if(angleDraft?.length){
  const [vertex,a,b]=angleDraft;
  const mark=`<circle cx="${vertex.x}" cy="${vertex.y}" r=".05" fill="#2164ff"/>`;
  const radius=b?angleRadius(vertex,a,b):0;
  content+=`<g pointer-events="none" style="--plan-text:#2164ff;--plan-dimension:#2164ff">${mark}${b?angularDimension({vertex,a,b,radius},false):a?trace([vertex,a],'stroke="#2164ff" stroke-width=".024"'):''}</g>`;
 }
 content+=editorOverlay(floor,{selectedId,axes,axisTypes,labels,dimensions,interactive,unit,feedback,bounds});
 if(measurement)content+=measurementOverlay(measurement,unit,dark);
 return {content:defs+`<g style="${Object.entries(colors).map(([k,v])=>k+':'+v).join(';')}" font-family="Segoe UI,Arial,sans-serif">${content}</g>`};
}
export function planBounds(floor,referenceFloors=[]){
 const points=[];
 for(const level of [floor,...referenceFloors]){
  for(const contour of floorTiltProjections(level).values())points.push(...contour);
  for(const e of level.structures||[])points.push(...elementFootprint(e));
  for(const wall of level.walls)points.push(wall.a,wall.b);for(const s of level.slabs)points.push(...s.points);
  for(const e of level.furniture){const angle=e.rotation*Math.PI/180;for(const [x,y] of [[0,0],[e.w,0],[e.w,e.d],[0,e.d]])points.push({x:e.x+x*Math.cos(angle)-y*Math.sin(angle),y:e.y+x*Math.sin(angle)+y*Math.cos(angle)});}
 }
 for(const r of floor.rooms){const f=elementFrame(r);for(const [x,y] of [[0,0],[f.w,0],[f.w,f.h],[0,f.h]])points.push(framePoint(f,x,y));}
 for(const d of floor.dimensions){
  if(d.mode==='angle'){const {rays,arc,label}=angleGeometry(d);points.push(...rays,...arc,label);continue;}
  const l=wallLength(d)||1,px=-(d.b.y-d.a.y)/l*d.offset,py=(d.b.x-d.a.x)/l*d.offset;points.push(d.a,d.b,{x:d.a.x+px,y:d.a.y+py},{x:d.b.x+px,y:d.b.y+py});
 }
 if(!points.length)return {x:-2,y:-2,w:16,h:14};
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const p of points){left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);}
 return {x:left-1,y:top-1.2,w:Math.max(4,right-left+2),h:Math.max(4,bottom-top+2.4)};
}
export function exportSVG(floor,options){const b=planBounds(floor);return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1500" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" style="--canvas:#fff;background:white">${renderPlan(floor,{...options,dark:false,grid:false,selectedId:null,selectedIds:new Set(),interactive:false,axes:false,measurement:null,feedback:{}}).content}</svg>`;}
