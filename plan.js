import {wallLength,wallSegments} from './model.js';
import {furniturePlan} from './furniture-plan.js';
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
export function renderPlan(floor,{selectedId,grid=true,labels=true,dimensions=true,dark=false,draft=[]}={}){
 const colors=dark?{'--plan-text':'#dce5f2','--plan-dimension':'#778799','--wall-fill':'#737d8d','--wall-line':'#9ca9bc','--furniture-stroke':'#8794a6','--furniture-fill':'#2b3441','--plant-fill':'#394b40','--plant-stroke':'#758f7c'}:{'--plan-text':'#313b48','--plan-dimension':'#9ba3ae','--wall-fill':'#7f848c','--wall-line':'#525b67','--furniture-stroke':'#939b9f','--furniture-fill':'#fafbf9','--plant-fill':'#f0f5ee','--plant-stroke':'#a0b19c'};
 const defs=`<defs><pattern id="dots" width=".25" height=".25" patternUnits="userSpaceOnUse"><circle cx=".02" cy=".02" r=".009" fill="${dark?'#3e4857':'#dce2eb'}"/></pattern><pattern id="deck" width=".14" height=".14" patternUnits="userSpaceOnUse"><rect width=".14" height=".14" fill="${dark?'#2e343b':'#fafaf7'}"/><path d="M0 .14H.14" fill="none" stroke="${dark?'#414a52':'#dce0da'}" stroke-width=".009"/></pattern><pattern id="tiles" width=".28" height=".28" patternUnits="userSpaceOnUse"><path d="M.28 0H0V.28" fill="none" stroke="${dark?'#3c4652':'#e1e5e7'}" stroke-width=".012"/></pattern></defs>`;
 let content=grid?rect(-100,-100,200,200,'fill="url(#dots)"'):'';
 for(const slab of floor.slabs)content+=`<polygon points="${slab.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${slab.finish==='deck'?'url(#deck)':dark?'#252c36':'#fff'}" stroke="${selectedId===slab.id?'#2164ff':dark?'#526071':'#dce1e6'}" stroke-width="${selectedId===slab.id?.045:.015}" data-element="${esc(slab.id)}" class="movable-element"/>`;
 for(const room of floor.rooms){if(room.name==='Санузел')content+=rect(room.x,room.y,room.w,room.h,'fill="url(#tiles)" pointer-events="none"');if(room.id===selectedId)content+=rect(room.x,room.y,room.w,room.h,'fill="#2164ff0b" stroke="#2164ff" stroke-width=".025" stroke-dasharray=".1 .06" pointer-events="none"');}
 content+=furniturePlan(floor.furniture,selectedId);
 for(const wall of floor.walls){
  const l=wallLength(wall),angle=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x)*180/Math.PI,selected=selectedId===wall.id;
  content+=`<g transform="translate(${wall.a.x} ${wall.a.y}) rotate(${angle})" data-element="${esc(wall.id)}" class="movable-element">`;
  content+=rect(0,-Math.max(.15,wall.thickness/2),l,Math.max(.3,wall.thickness),'fill="transparent" stroke="none"');
  for(const [start,end] of wallSegments(wall))content+=rect(start,-wall.thickness/2,end-start,wall.thickness,`fill="${selected?'#a9c7ff':'var(--wall-fill)'}" stroke="${selected?'#2164ff':'var(--wall-line)'}" stroke-width="${selected?.035:.018}"`);
  for(const o of wall.openings){const x=o.position-o.width/2,sel=selectedId===o.id;content+=`<g data-element="${esc(o.id)}" stroke="${sel?'#2164ff':'var(--furniture-stroke)'}" stroke-width="${sel?.035:.016}" fill="none">${rect(x,-wall.thickness/2,o.width,wall.thickness,'fill="var(--canvas,#fff)"')}`;
   if(o.kind==='window')content+=path(`M${n(x)} -.045h${n(o.width)}M${n(x)} .045h${n(o.width)}`);
   else content+=path(`M${n(x)} 0v${n(o.width)}M${n(x)} ${n(o.width)}A${n(o.width)} ${n(o.width)} 0 0 0 ${n(x+o.width)} 0`);
   content+='</g>';
  }
  if(selected)content+=rect(-.065,-.065,.13,.13,'fill="#fff" stroke="#2164ff" stroke-width=".035"')+rect(l-.065,-.065,.13,.13,'fill="#fff" stroke="#2164ff" stroke-width=".035"');
  content+='</g>';
 }
 if(labels)for(const r of floor.rooms){const x=r.x+r.w/2,y=r.y+r.h/2;content+=`<g fill="${r.id===selectedId?'#2164ff':'var(--plan-text)'}" text-anchor="middle" data-element="${esc(r.id)}" class="movable-element">${rect(x-1,y-.25,2,.65,'fill="transparent"')}${text(x,y,r.name,'font-size=".205" font-weight="550"')}${text(x,y+.29,`${(r.w*r.h).toLocaleString('ru-RU',{maximumFractionDigits:1})} м²`,'font-size=".175"')}</g>`;}
 if(dimensions)for(const d of floor.dimensions){const dx=d.b.x-d.a.x,dy=d.b.y-d.a.y,l=Math.hypot(dx,dy)||1,px=-dy/l*d.offset,py=dx/l*d.offset;content+=`<g data-element="${esc(d.id)}" class="movable-element" ${d.id===selectedId?'style="--plan-text:#2164ff;--plan-dimension:#2164ff"':''}>${dimension(d.a,d.b,d.offset)}<path d="M${n(d.a.x+px)} ${n(d.a.y+py)}L${n(d.b.x+px)} ${n(d.b.y+py)}" stroke="transparent" stroke-width=".22"/></g>`;}
 if(draft.length)content+=`<polyline points="${draft.map(p=>`${p.x},${p.y}`).join(' ')}" stroke="#2164ff" fill="#2164ff0c" stroke-width=".035" stroke-dasharray=".1 .08" pointer-events="none"/>${draft.map(p=>`<circle cx="${p.x}" cy="${p.y}" r=".055" fill="#2164ff"/>`).join('')}`;
 return {content:defs+`<g style="${Object.entries(colors).map(([k,v])=>k+':'+v).join(';')}" font-family="Segoe UI,Arial,sans-serif">${content}</g>`};
}
export function planBounds(floor){
 const points=[];for(const wall of floor.walls)points.push(wall.a,wall.b);for(const s of floor.slabs)points.push(...s.points);
 for(const e of floor.furniture){const angle=e.rotation*Math.PI/180;for(const [x,y] of [[0,0],[e.w,0],[e.w,e.d],[0,e.d]])points.push({x:e.x+x*Math.cos(angle)-y*Math.sin(angle),y:e.y+x*Math.sin(angle)+y*Math.cos(angle)});}
 for(const r of floor.rooms)points.push({x:r.x,y:r.y},{x:r.x+r.w,y:r.y+r.h});
 for(const d of floor.dimensions){const l=wallLength(d)||1,px=-(d.b.y-d.a.y)/l*d.offset,py=(d.b.x-d.a.x)/l*d.offset;points.push(d.a,d.b,{x:d.a.x+px,y:d.a.y+py},{x:d.b.x+px,y:d.b.y+py});}
 if(!points.length)return {x:-2,y:-2,w:16,h:14};
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs)-1,y=Math.min(...ys)-1.2;
 return {x,y,w:Math.max(4,Math.max(...xs)-x+1),h:Math.max(4,Math.max(...ys)-y+1.2)};
}
export function exportSVG(floor,options){const b=planBounds(floor);return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1500" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" style="--canvas:#fff;background:white">${renderPlan(floor,{...options,dark:false,grid:false,selectedId:null}).content}</svg>`;}
