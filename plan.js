import {wallLength,wallSegments} from './model.js';
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
function furniture(floor){
 const desk=(x,y)=>`<g transform="translate(${x} ${y})">${rect(0,0,1.6,.7,'rx=".025"')}${rect(.58,.13,.5,.28,'rx=".02"')}${path('M.83 .41v.1m-.17 0H1')}${rect(.56,.88,.48,.42,'rx=".08"')}${path('M.8 1.3v.13m-.25 0h.5')}</g>`;
 const plant=(x,y)=>`<g transform="translate(${x} ${y})"><circle r=".17" fill="var(--plant-fill)" stroke="var(--plant-stroke)"/><path d="M-.23-.07 .19 .12M-.15 .18 .16-.19M-.01-.25 0 .23M-.23 .06 .23-.07" stroke="var(--plant-stroke)"/></g>`;
 const table=(x,y)=>`<g transform="translate(${x} ${y})">${rect(0,0,1.55,.95,'rx=".11" fill="var(--furniture-fill)"')}${[.16,.9].map(cx=>rect(cx,-.38,.47,.33,'rx=".07"')+rect(cx,1,.47,.33,'rx=".07"')).join('')}${rect(-.38,.24,.33,.47,'rx=".07"')}${rect(1.6,.24,.33,.47,'rx=".07"')}</g>`;
 const sofa=(x,y)=>`<g transform="translate(${x} ${y})">${rect(0,0,2.9,.95,'rx=".12" fill="var(--furniture-fill)"')}${rect(.14,.12,2.62,.3,'rx=".08"')}${[.23,1.06,1.89].map(cx=>rect(cx,.45,.77,.4,'rx=".055"')).join('')}${rect(-.1,.24,.29,.6,'rx=".06"')}${rect(2.7,.24,.29,.6,'rx=".06"')}${rect(.65,1.53,1.55,.67,'rx=".04"')}${rect(-.28,1.22,3.42,1.5,'rx=".05" stroke-dasharray=".025 .045" fill="none"')}</g>`;
 const bed=(x,y)=>`<g transform="translate(${x} ${y})">${rect(0,0,1.85,2.1,'rx=".04"')}${rect(.08,.15,.78,.4,'rx=".05"')}${rect(.98,.15,.78,.4,'rx=".05"')}${path('M.04 .65h1.77M.04 1.9h1.77')}${rect(-.55,.05,.42,.5)}${rect(1.98,.05,.42,.5)}</g>`;
 const main=floor.elevation===0?desk(.9,.65)+table(9.1,2.3)+sofa(1.1,6)+table(8.6,6.7):bed(1.2,.75)+bed(9,.75)+bed(2.6,6);
 return `<g stroke="var(--furniture-stroke)" stroke-width=".014" fill="none">${main}${plant(3.65,.6)}${plant(.55,8.25)}${rect(8.25,.23,3.4,.62,'fill="var(--furniture-fill)"')}${rect(11.15,.85,.5,1.6,'fill="var(--furniture-fill)"')}${rect(9.15,.32,.65,.4,'rx=".08"')}${[0,1].map(i=>`<circle cx="11.39" cy="${1.04+i*.37}" r=".11"/>`).join('')}${rect(.3,3.8,.75,1.35,'rx=".05"')}${rect(.38,3.9,.59,1.15,'rx=".1"')}${rect(1.65,3.76,.49,.39,'rx=".06"')}${rect(1.71,4.64,.45,.59,'rx=".2"')}${rect(2.81,3.8,.6,.6,'rx=".02"')}<circle cx="3.11" cy="4.1" r=".2"/>${rect(6.34,.5,1.13,3.3)}${Array.from({length:14},(_,i)=>path(`M6.34 ${n(.65+i*.225)}h1.13`)).join('')}${path('M6.9 3.5V.85m-.12.2.12-.2.12.2')}${rect(-.15,9.15,12.3,2.15,'fill="url(#deck)" stroke-width=".02"')}${table(8.7,9.8)}${plant(.4,10.95)}${plant(11.5,10.95)}${rect(.6,9.65,.7,1.3,'rx=".04" transform="rotate(-20 .95 10.3)"')}${text(5.4,10.4,'Терраса','fill="var(--plan-text)" stroke="none" text-anchor="middle" font-size=".2"')}${rect(5.2,-1.15,1.6,1,'fill="url(#deck)"')}${path('M5.2-1h1.6m-1.6-.12h1.6')}</g>`;
}
export function renderPlan(floor,{selectedId,grid=true,labels=true,dimensions=true,dark=false,draft=[]}={}){
 const colors=dark?{'--plan-text':'#dce5f2','--plan-dimension':'#778799','--wall-fill':'#737d8d','--wall-line':'#9ca9bc','--furniture-stroke':'#8794a6','--furniture-fill':'#2b3441','--plant-fill':'#394b40','--plant-stroke':'#758f7c'}:{'--plan-text':'#313b48','--plan-dimension':'#9ba3ae','--wall-fill':'#7f848c','--wall-line':'#525b67','--furniture-stroke':'#939b9f','--furniture-fill':'#fafbf9','--plant-fill':'#f0f5ee','--plant-stroke':'#a0b19c'};
 const defs=`<defs><pattern id="dots" width=".25" height=".25" patternUnits="userSpaceOnUse"><circle cx=".02" cy=".02" r=".009" fill="${dark?'#3e4857':'#dce2eb'}"/></pattern><pattern id="deck" width=".14" height=".14" patternUnits="userSpaceOnUse"><rect width=".14" height=".14" fill="${dark?'#2e343b':'#fafaf7'}"/><path d="M0 .14H.14" fill="none" stroke="${dark?'#414a52':'#dce0da'}" stroke-width=".009"/></pattern><pattern id="tiles" width=".28" height=".28" patternUnits="userSpaceOnUse"><path d="M.28 0H0V.28" fill="none" stroke="${dark?'#3c4652':'#e1e5e7'}" stroke-width=".012"/></pattern></defs>`;
 let content=grid?rect(-100,-100,200,200,'fill="url(#dots)"'):'';
 for(const slab of floor.slabs)content+=`<polygon points="${slab.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${dark?'#252c36':'#fff'}" stroke="${selectedId===slab.id?'#2164ff':'none'}" stroke-width=".045" data-element="${esc(slab.id)}"/>`;
 content+=rect(.15,3.58,2.27,1.84,'fill="url(#tiles)"');content+=furniture(floor);
 for(const wall of floor.walls){
  const l=wallLength(wall),angle=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x)*180/Math.PI,selected=selectedId===wall.id;
  content+=`<g transform="translate(${wall.a.x} ${wall.a.y}) rotate(${angle})" data-element="${esc(wall.id)}">`;
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
 if(labels)for(const r of floor.rooms){const x=r.x+r.w/2,y=r.y+r.h/2+(r.name==='Кухня'?.15:0);content+=`<g fill="var(--plan-text)" text-anchor="middle" pointer-events="none">${text(x,y,r.name,'font-size=".205" font-weight="550"')}${text(x,y+.29,`${(r.w*r.h).toLocaleString('ru-RU',{maximumFractionDigits:1})} м²`,'font-size=".175"')}</g>`;}
 if(dimensions){content+=dimension({x:0,y:0},{x:12,y:0},-1.62)+dimension({x:0,y:0},{x:4.2,y:0},-1.04)+dimension({x:4.2,y:0},{x:8,y:0},-1.04)+dimension({x:8,y:0},{x:12,y:0},-1.04)+dimension({x:0,y:9},{x:0,y:0},-1.1)+dimension({x:0,y:9},{x:12,y:9},3.05);for(const d of floor.dimensions)content+=dimension(d.a,d.b,.5);}
 if(draft.length)content+=`<polyline points="${draft.map(p=>`${p.x},${p.y}`).join(' ')}" stroke="#2164ff" fill="#2164ff0c" stroke-width=".035" stroke-dasharray=".1 .08" pointer-events="none"/>${draft.map(p=>`<circle cx="${p.x}" cy="${p.y}" r=".055" fill="#2164ff"/>`).join('')}`;
 return {content:defs+`<g style="${Object.entries(colors).map(([k,v])=>k+':'+v).join(';')}" font-family="Segoe UI,Arial,sans-serif">${content}</g>`};
}
export function exportSVG(floor,options){return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1500" viewBox="-2.1 -2.3 16.2 15.1" style="--canvas:#fff;background:white">${renderPlan(floor,{...options,dark:false,grid:false,selectedId:null}).content}</svg>`;}
