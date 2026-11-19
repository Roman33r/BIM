import {openingSpan,wallLength,wallSegments} from './model.js';
import {furniturePlan} from './furniture-plan.js';
import {renderHoleXray} from './hole-display.js';
import {componentHoles,solidBodies,pointInside} from './assembly.js';
import {verticalRange} from './vertical.js';
import {editorOverlay} from './editor-overlay.js';
import {elementFrame,elementFootprint,framePoint,dot,sub} from './transforms.js';
import {angleGeometry,angleLabel,angleRadius} from './annotations.js';
import {hiddenWallEnds} from './wall-overlaps.js';
import {materialPatterns,materialSpec} from './materials.js';
import {isPileCap,isRoundStructure,pileFootprintDiameter,rimBoardSegments} from './structures.js';
import {segmentMeasurement} from './measurements.js';
import {floorTiltProjections} from './spatial.js';
import {guidePoints,guideDash} from './construction-guides.js';
import {selectedPileDimensions} from './pile-layout.js';
import {validGridStep} from './grid.js';
import {capHoles,isFastener,isRingFastener,fastenerFamily} from './hardware.js';
import {boardMountPoints} from './board-mounts.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const n=value=>Number(value.toFixed(4));
const path=(d,attrs='')=>`<path d="${d}" ${attrs}/>`;
const rect=(x,y,w,h,attrs='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attrs}/>`;
const text=(x,y,value,attrs='')=>`<text x="${n(x)}" y="${n(y)}" ${attrs}>${esc(value)}</text>`;
function dimension(a,b,offset=0.6){
 const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);if(!l)return '';
 const px=-dy/l,py=dx/l,side=Math.sign(offset)||1,x1=a.x+px*offset,y1=a.y+py*offset,x2=b.x+px*offset,y2=b.y+py*offset;
 return `<g fill="none" stroke="var(--plan-dimension)" stroke-width=".012">${path(`M${n(a.x+px*0.12*side)} ${n(a.y+py*0.12*side)}L${n(x1+px*.14*side)} ${n(y1+py*.14*side)}M${n(b.x+px*.12*side)} ${n(b.y+py*.12*side)}L${n(x2+px*.14*side)} ${n(y2+py*.14*side)}M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`)}${[a,b].map(p=>path(`M${n(p.x+px*offset-.065)} ${n(p.y+py*offset+.09)}l.13 -.18`)).join('')}</g>${text((x1+x2)/2+px*.12*side,(y1+y2)/2+py*.12*side,Math.round(l*1000).toLocaleString('ru-RU'),`fill="var(--plan-text)" font-size=".19" text-anchor="middle" transform="rotate(${n(Math.atan2(dy,dx)*180/Math.PI)} ${n((x1+x2)/2+px*.12*side)} ${n((y1+y2)/2+py*.12*side)})"`)}`;
}
const coords=points=>points.map(p=>`${n(p.x)},${n(p.y)}`).join(' ');
const trace=(points,attrs='')=>`<polyline points="${coords(points)}" ${attrs}/>`;
function constructionPlan(floor,selectedIds,unit){
 let output='';
 for(const e of floor.construction||[]){
  const selected=selectedIds.has(e.id),color=selected?'#2164ff':'#bb7c31',points=guidePoints(e);
  output+=`<g data-element="${esc(e.id)}" data-guide-type="${e.type}" class="movable-element" stroke="${color}" fill="none">`;
  if(e.type==='line'){
   output+=trace([e.a,e.b],`stroke-dasharray="${guideDash(e.style)}" stroke-width="${selected?2:1.2}" vector-effect="non-scaling-stroke"`);
   output+=trace([e.a,e.b],'stroke="transparent" stroke-width="10" vector-effect="non-scaling-stroke"');
  }
  for(const p of points){
   const radius=(e.type==='point'?5:3)*unit;
   output+=`<circle cx="${p.x}" cy="${p.y}" r="${radius}" fill="var(--canvas,#fff)" stroke-width="1.3" vector-effect="non-scaling-stroke"/>`;
   if(e.type==='point')output+=path(`M${p.x-9*unit} ${p.y}h${18*unit}M${p.x} ${p.y-9*unit}v${18*unit}`,'stroke-width="1" vector-effect="non-scaling-stroke"')
    +`<circle cx="${p.x}" cy="${p.y}" r="${11*unit}" fill="transparent" stroke="none"/>`;
  }
  output+='</g>';
 }
 return output;
}
function structureShape(element,attrs='',members=[]){
 if(element.drillHoles?.length){
  const top=verticalRange(element)[1],holes=componentHoles(element,members).filter(h=>Math.abs(h.top-top)<1e-6);
  return solidBodies(element,members).map(body=>`<path class="drilled-component" d="M${body.footprint.map(p=>`${p.x} ${p.y}`).join('L')}Z${holes.filter(h=>pointInside(h,body.footprint,h.radius*.999)).map(({x,y,radius:r})=>`M${x+r} ${y}a${r} ${r} 0 1 0 ${-2*r} 0a${r} ${r} 0 1 0 ${2*r} 0Z`).join('')}" fill-rule="evenodd" ${attrs}/>`).join('');
 }

 if(element.type==='rimBoard'&&element.mounts?.length){
  const outer=elementFootprint(element),holes=boardMountPoints(element,members).map(m=>m.point);
  return `<path class="mounted-rim-board" d="M${outer.map(p=>`${p.x} ${p.y}`).join('L')}Z${holes.map(({x,y,radius:r})=>`M${x+r} ${y}a${r} ${r} 0 1 0 ${-2*r} 0a${r} ${r} 0 1 0 ${2*r} 0Z`).join('')}" fill-rule="evenodd" ${attrs}/>`;
 }
 if(isPileCap(element)){
  const outer=elementFootprint(element),holes=capHoles(element);
  const outline=`M${outer.map(p=>`${n(p.x)} ${n(p.y)}`).join('L')}Z`;
  const voids=holes.map(({x,y,radius:r})=>`M${n(x+r)} ${n(y)}a${r} ${r} 0 1 0 ${-2*r} 0a${r} ${r} 0 1 0 ${2*r} 0Z`).join('');
  return `<path class="perforated-pile-cap" data-hole-count="${holes.length}" d="${outline+voids}" fill-rule="evenodd" ${attrs}/>`;
 }
 if(isFastener(element)){
  const {x,y,headDiameter,diameter,type,rotation}=element,r=headDiameter/2;
  const outer=['bolt','anchor','nut'].includes(fastenerFamily(element))?Array.from({length:6},(_,i)=>({x:x+r*Math.cos(i*Math.PI/3+rotation*Math.PI/180),y:y+r*Math.sin(i*Math.PI/3+rotation*Math.PI/180)})):null;
  const outline=outer?`M${outer.map(p=>`${p.x} ${p.y}`).join('L')}Z`:`M${x+r} ${y}a${r} ${r} 0 1 0 ${-2*r} 0a${r} ${r} 0 1 0 ${2*r} 0Z`;
  const hole=isRingFastener(element)?`M${x+diameter/2} ${y}a${diameter/2} ${diameter/2} 0 1 0 ${-diameter} 0a${diameter/2} ${diameter/2} 0 1 0 ${diameter} 0Z`:'';
  return `<path class="fastener-head" d="${outline+hole}" fill-rule="evenodd" ${attrs}/>`;
 }
 if(isRoundStructure(element))return `<circle cx="${n(element.x)}" cy="${n(element.y)}" r="${n(pileFootprintDiameter(element)/2)}" ${attrs}/>`;
 if(element.type==='rim')return rimBoardSegments(element,members).map(board=>`<polygon class="rim-board" points="${coords(elementFootprint({...element,...board}))}" ${attrs}/>`).join('');
 return `<polygon points="${coords(elementFootprint(element))}" ${attrs}/>`;
}
function structurePlan(element,selected,fill,dark,members=[]){
 const foundation=element.kind==='foundation',stroke=selected?'#2164ff':dark?'#b8c9dd':'#54677c';
 const attrs=`fill="${fill}" fill-opacity="${foundation&&!selected?.72:1}" stroke="${stroke}" stroke-width="${selected?1.9:1.2}"`
  +(foundation&&!isPileCap(element)?' stroke-dasharray="5 3"':'')+' vector-effect="non-scaling-stroke"';
 let geometry=element.type==='screwPile'
  ?structureShape(element,`fill="transparent" stroke="${stroke}" stroke-dasharray="4 3" stroke-width="${selected?1.9:1.2}" vector-effect="non-scaling-stroke"`)
   +`<circle cx="${n(element.x)}" cy="${n(element.y)}" r="${n(element.diameter/2)}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`
  :structureShape(element,attrs,members);
 if(isFastener(element)){
  const {x,y}=element,r=element.headDiameter*.28,angle=(element.rotation||0)*Math.PI/180;
  if(fastenerFamily(element)==='screw')geometry+=trace([{x:x-r*Math.cos(angle),y:y-r*Math.sin(angle)},{x:x+r*Math.cos(angle),y:y+r*Math.sin(angle)}],`stroke="${stroke}" stroke-width=".0008"`)+trace([{x:x+r*Math.sin(angle),y:y-r*Math.cos(angle)},{x:x-r*Math.sin(angle),y:y+r*Math.cos(angle)}],`stroke="${stroke}" stroke-width=".0008"`);
  geometry+=`<circle cx="${x}" cy="${y}" r="${element.headDiameter/2}" fill="transparent" stroke="transparent" stroke-width="8" vector-effect="non-scaling-stroke"/>`;
 }
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
function pileSelectionOverlay(floor,selectedIds,unit){
 const measured=selectedPileDimensions(floor,selectedIds);
 if(!measured)return '';
 const format=value=>Math.round(value*1000).toLocaleString('ru-RU');
 const stroke='stroke="#2164ff" stroke-width="1" vector-effect="non-scaling-stroke"';
 const caption=(x,y,label,angle=0)=>text(x,y,label,`class="editor-measure" font-size="${11*unit}" text-anchor="middle" fill="#2164ff"${angle?` transform="rotate(${angle} ${n(x)} ${n(y)})"`:''}`);
 let content='';
 for(const {a,b,length,angle} of measured.links){
  content+=trace([a,b],stroke);
  if(length/unit>=65||measured.links.length===1)content+=caption((a.x+b.x)/2,(a.y+b.y)/2-10*unit,`Центры ${format(length)} мм · ${angle.toLocaleString('ru-RU',{maximumFractionDigits:1})}°`);
 }
 for(const {a,b,length,axis} of measured.overall){
  const offset=38*unit,start={x:a.x+(axis==='y'?offset:0),y:a.y-(axis==='x'?offset:0)},end={x:b.x+(axis==='y'?offset:0),y:b.y-(axis==='x'?offset:0)};
  content+=`<g class="pile-overall-dimension" data-axis="${axis}">${trace([a,start,end,b],stroke)}`;
  for(const p of [start,end])content+=trace([{x:p.x-3*unit,y:p.y+3*unit},{x:p.x+3*unit,y:p.y-3*unit}],stroke);
  content+=caption((start.x+end.x)/2+(axis==='y'?14*unit:0),(start.y+end.y)/2-(axis==='x'?9*unit:0),`${axis==='x'?'Общая длина':'Общая ширина'} ${format(length)} мм`,axis==='y'?-90:0)+'</g>';
 }
 return `<g class="pile-selection-dimensions" pointer-events="none" fill="none">${content}</g>`;
}
function floorReference(floor,color){
 const close=points=>trace([...points,points[0]]);
 let outlines=floor.slabs.map(slab=>close(slab.points)).join('')+(floor.structures||[]).map(e=>structureShape(e,'',floor.structures)).join('');
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
export function renderPlan(floor,{selectedId,selectedIds=new Set(selectedId?[selectedId]:[]),grid=true,gridStep=.25,labels=true,dimensions=true,dark=false,textures=true,holeXray=false,draft=[],angleDraft,dimensionDraft,structurePreview,measurement,drawMeasurement,pileArea,referenceFloors=[],interactive=false,axes=false,axisTypes,unit=.02,feedback={},bounds}={}){
 const colors=dark?{'--plan-text':'#dce5f2','--plan-dimension':'#778799','--wall-fill':'#737d8d','--wall-line':'#9ca9bc','--furniture-stroke':'#8794a6','--furniture-fill':'#2b3441','--plant-fill':'#394b40','--plant-stroke':'#758f7c'}:{'--plan-text':'#313b48','--plan-dimension':'#9ba3ae','--wall-fill':'#7f848c','--wall-line':'#525b67','--furniture-stroke':'#939b9f','--furniture-fill':'#fafbf9','--plant-fill':'#f0f5ee','--plant-stroke':'#a0b19c'};
 if(!textures){
  colors['--furniture-fill']='#fff';colors['--plant-fill']='#fff';
  colors['--wall-line']='#667282';
 }
 const tilePattern=textures?`<pattern id="tiles" width=".28" height=".28" patternUnits="userSpaceOnUse"><path d="M.28 0H0V.28" fill="none" stroke="${dark?'#3c4652':'#e1e5e7'}" stroke-width=".012"/></pattern>`+materialPatterns(dark):'';
 const cell=validGridStep(gridStep)?gridStep:.25,visualCell=cell*10**Math.max(0,Math.ceil(Math.log10(9*unit/cell)));
 const major=visualCell*5,minorColor=dark?'#354150':'#d5dce6',majorColor=dark?'#526276':'#aebbcf';
 const defs=`<defs>
  <pattern id="grid-minor" width="${visualCell}" height="${visualCell}" patternUnits="userSpaceOnUse"><path d="M${visualCell} 0H0V${visualCell}" fill="none" stroke="${minorColor}" stroke-width=".65" vector-effect="non-scaling-stroke"/></pattern>
  <pattern id="grid-major" width="${major}" height="${major}" patternUnits="userSpaceOnUse"><rect width="${major}" height="${major}" fill="url(#grid-minor)"/><path d="M${major} 0H0V${major}" fill="none" stroke="${majorColor}" stroke-width="1.15" vector-effect="non-scaling-stroke"/></pattern>
  ${tilePattern}</defs>`;
 const surfaceFill=material=>textures?`url(#material-${materialSpec(material).id})`:'#fff';
 let content=grid?rect(-10000,-10000,20000,20000,'fill="url(#grid-major)"'):'';
 for(const slab of floor.slabs){const attrs=`fill="${surfaceFill(slab.material)}" fill-opacity="${textures?(dark?.28:.24):1}" stroke="${selectedIds.has(slab.id)?'#2164ff':dark?'#526071':'#b5bec8'}" stroke-width="${selectedIds.has(slab.id)?.045:.015}" data-element="${esc(slab.id)}" class="movable-element"`;content+=slab.drillHoles?.length?structureShape(slab,attrs,floor.structures):`<polygon points="${coords(slab.points)}" ${attrs}/>`;}
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
 for(const e of structures)if(e.kind==='framing')content+=structurePlan(e,selectedIds.has(e.id),surfaceFill(e.material),dark,structures);
 for(const e of structures)if(isFastener(e))content+=structurePlan(e,selectedIds.has(e.id),surfaceFill(e.material),dark);
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
 if(dimensionDraft){
  const {a,b,offset}=dimensionDraft;
  content+=`<g class="dimension-preview" pointer-events="none" style="--plan-text:#2164ff;--plan-dimension:#2164ff">${dimension(a,b,offset)}${[a,b].map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${3*unit}" fill="#2164ff"/>`).join('')}</g>`;
 }
 if(structurePreview)content+=structureShape(structurePreview,'fill="#2164ff" fill-opacity=".12" stroke="#2164ff" stroke-width="1.3" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" pointer-events="none"',structures);
 if(angleDraft?.length){
  const [vertex,a,b]=angleDraft;
  const mark=`<circle cx="${vertex.x}" cy="${vertex.y}" r=".05" fill="#2164ff"/>`;
  const radius=b?angleRadius(vertex,a,b):0;
  content+=`<g pointer-events="none" style="--plan-text:#2164ff;--plan-dimension:#2164ff">${mark}${b?angularDimension({vertex,a,b,radius},false):a?trace([vertex,a],'stroke="#2164ff" stroke-width=".024"'):''}</g>`;
 }
 content+=constructionPlan(floor,selectedIds,unit);
 if(holeXray)content+=renderHoleXray([...referenceFloors,floor],'top',dark);
 content+=editorOverlay(floor,{selectedId,axes,axisTypes,labels,dimensions,interactive,unit,feedback,bounds});
 if(dimensions&&interactive)content+=pileSelectionOverlay(floor,selectedIds,unit);
 if(pileArea){
  const x=Math.min(pileArea.a.x,pileArea.b.x),y=Math.min(pileArea.a.y,pileArea.b.y);
  const width=Math.abs(pileArea.b.x-pileArea.a.x),height=Math.abs(pileArea.b.y-pileArea.a.y),mm=value=>Math.round(value*1000).toLocaleString('ru-RU');
  content+=rect(x,y,width,height,'class="pile-area-preview" fill="#2164ff" fill-opacity=".06" stroke="#2164ff" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"');
  content+=text(x+width/2,y-12*unit,`${mm(width)} × ${mm(height)} мм`,'class="editor-measure pile-area-size" fill="#2164ff" font-size="'+(12*unit)+'" text-anchor="middle"');
  content+=text(x+width+9*unit,y+height/2,`${mm(height)} мм`,'class="editor-measure" fill="#2164ff" font-size="'+(11*unit)+'"');
  for(const p of pileArea.points)content+=`<circle cx="${p.x}" cy="${p.y}" r="${4*unit}" fill="#2164ff" pointer-events="none"/>`;
 }
 if(measurement)content+=measurementOverlay(measurement,unit,dark);
 if(drawMeasurement)content+=measurementOverlay(drawMeasurement,unit,dark);
 return {content:defs+`<g style="${Object.entries(colors).map(([k,v])=>k+':'+v).join(';')}" font-family="Segoe UI,Arial,sans-serif">${content}</g>`};
}
export function planBounds(floor,referenceFloors=[]){
 const points=[];
 for(const level of [floor,...referenceFloors]){
  for(const e of level.construction||[])points.push(...guidePoints(e));
  for(const contour of floorTiltProjections(level).values())points.push(...contour);
  for(const e of level.structures||[])points.push(...(e.type==='rim'?rimBoardSegments(e,level.structures).flatMap(board=>elementFootprint({...e,...board})):elementFootprint(e)));
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
