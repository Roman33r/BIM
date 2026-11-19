import {findElement} from './elements.js';
import {elementFrame,elementAxes,framePoint,transformHandles,elementAngle} from './transforms.js';
import {axisElements,elementVisible} from './selection.js';
import {isRoundStructure} from './structures.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const line=(a,b,attrs='')=>`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${attrs}/>`;
export function editorOverlay(floor,{selectedId,axes=false,axisTypes,labels,dimensions,interactive=false,unit=.02,feedback={},bounds={x:-100,y:-100,w:200,h:200}}={}){
 let output='';const found=findElement(floor,selectedId);
 if(axes){
  for(const {element,host} of axisElements(floor,{axisTypes,labels,dimensions})){
   for(const axis of elementAxes(element,host)){
    const {center,direction,extent}=axis;
    output+=line({x:center.x-direction.x*extent,y:center.y-direction.y*extent},
     {x:center.x+direction.x*extent,y:center.y+direction.y*extent},'class="symmetry-axis"');
   }
  }
 }
 if(found&&interactive&&elementVisible(found.element,{labels,dimensions})){const {element:e,host}=found,f=elementFrame(e,host);
  const corners=[[0,0],[f.w,0],[f.w,f.h],[0,f.h]].map(([x,y])=>framePoint(f,x,y));
  if(e.mode!=='angle')output+=`<polygon points="${corners.map(p=>`${p.x},${p.y}`).join(' ')}" class="transform-outline"/>`;
  const handles=transformHandles(e,host,unit);
  for(const h of handles){const rotation=h.key==='rotate';if(rotation)output+=line(framePoint(f,f.w/2,0),h,'class="rotation-stem"');
   output+=`<g data-handle="${h.key}" data-owner="${esc(e.id)}" role="button" aria-label="${esc(h.label)}" class="transform-handle ${rotation?'rotation-handle':''}" style="cursor:${h.cursor}"><title>${esc(h.label)}</title><circle cx="${h.x}" cy="${h.y}" r="${(rotation?7:11)*unit}" fill="transparent"/>${rotation?`<circle cx="${h.x}" cy="${h.y}" r="${7*unit}" fill="var(--panel,#fff)" stroke="#2164ff" vector-effect="non-scaling-stroke"/><path d="M${h.x-3*unit} ${h.y+unit}a${3.3*unit} ${3.3*unit} 0 1 1 ${5*unit} ${-3*unit}m${-2*unit} ${-unit}h${3*unit}v${3*unit}" fill="none" stroke="#2164ff" vector-effect="non-scaling-stroke"/>`:`<rect x="${h.x-4*unit}" y="${h.y-4*unit}" width="${8*unit}" height="${8*unit}" rx="${unit}" fill="var(--panel,#fff)" stroke="#2164ff" vector-effect="non-scaling-stroke"/>`}</g>`;
  }
  const mm=value=>Math.round(value*1000);
  let label=e.kind==='dimension'?`${mm(f.w)} мм`:`${mm(f.w)} × ${mm(host?e.height:f.h)} мм`;
  if(isRoundStructure(e))label=e.type==='screwPile'?`Ствол Ø${mm(e.diameter)} · Лопасть Ø${mm(e.bladeDiameter)} мм`:`Ø${mm(e.diameter)} × ${mm(e.height)} мм`;
  else label+=` · ${Math.round(elementAngle(e,host)*10)/10}°`;
  if(e.mode!=='angle')output+=`<text x="${corners[2].x+8*unit}" y="${corners[2].y+17*unit}" font-size="${11*unit}" fill="#2164ff" class="editor-measure">${esc(label)}</text>`;
 }
 for(const g of feedback.guides||[]){let a=g.a,b=g.b;if(g.component==='x'){a={x:g.a.x,y:bounds.y};b={x:g.a.x,y:bounds.y+bounds.h};}if(g.component==='y'){a={x:bounds.x,y:g.a.y};b={x:bounds.x+bounds.w,y:g.a.y};}output+=line(a,b,`class="alignment-guide${g.axis?' axis-guide':''}"`);}
 if(feedback.marker){const m=feedback.marker,r=5*unit;output+=`<g data-snap-type="${esc(feedback.label||m.role)}" class="snap-marker">${m.role?.includes('Середина')?`<path d="M${m.x} ${m.y-r}l${r} ${2*r}h${-2*r}Z"/>`:`<circle cx="${m.x}" cy="${m.y}" r="${r}"/>`}<rect x="${m.x+9*unit}" y="${m.y-21*unit}" width="${130*unit}" height="${19*unit}" rx="${3*unit}" class="snap-label-bg"/><text x="${m.x+15*unit}" y="${m.y-8*unit}" font-size="${11*unit}">${esc(feedback.label||m.role)}</text></g>`;}
 return `<g class="editor-overlay">${output}</g>`;
}
