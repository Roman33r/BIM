const rect=(x,y,w,h,attrs='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`;
const path=d=>`<path d="${d}"/>`;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function furniturePlan(items,selectedId){return items.map(e=>{
 const {w,d,type}=e,selected=e.id===selectedId;
 let detail='';
 if(type==='sofa')detail=rect(.13,.12,w-.26,.25,'rx=".06"')+[0,1,2].map(i=>rect(.15+i*(w-.3)/3,.43,(w-.3)/3-.035,d-.52,'rx=".05"')).join('');
 else if(type==='chair')detail=path(`M.04 .12H${w-.04}M.04 .2H${w-.04}`);
 else if(type==='desk')detail=rect(w*.36,.12,w*.32,d*.4,'rx=".02"')+path(`M${w*.52} ${d*.57}v.1m-.13 0h.26`);
 else if(type==='bed')detail=rect(.1,.13,w*.4,.4,'rx=".06"')+rect(w*.54,.13,w*.4,.4,'rx=".06"')+path(`M.04 .65H${w-.04}M.04 ${d-.2}H${w-.04}`);
 else if(type==='plant')detail=`<circle cx="${w/2}" cy="${d/2}" r="${Math.min(w,d)*.42}" fill="var(--plant-fill)" stroke="var(--plant-stroke)"/>`+path(`M.03 .1 ${w-.03} ${d-.1}M.08 ${d-.02} ${w-.08} .02M${w/2} .01v${d-.02}`);
 else if(type==='stairs')detail=Array.from({length:14},(_,i)=>path(`M0 ${d*i/14}h${w}`)).join('')+path(`M${w/2} ${d-.1}V.2m-.12.2.12-.2.12.2`);
 else if(type==='sink'||type==='basin'||type==='tub')detail=rect(.08,.08,Math.max(.1,w-.16),Math.max(.1,d-.16),'rx=".08"');
 else if(type==='hob')detail=[.23,.7].map(t=>`<circle cx="${w/2}" cy="${d*t}" r="${w*.2}"/>`).join('');
 else if(type==='washer')detail=`<circle cx="${w/2}" cy="${d/2}" r="${Math.min(w,d)*.34}"/>`;
 else if(type==='toilet')detail=rect(.05,.05,w-.1,d*.3,'rx=".04"')+`<ellipse cx="${w/2}" cy="${d*.65}" rx="${w*.4}" ry="${d*.3}"/>`;
 const fill=type==='plant'||type==='rug'?'none':'var(--furniture-fill)';
 return `<g transform="translate(${e.x} ${e.y}) rotate(${e.rotation})" data-element="${esc(e.id)}" class="movable-element" stroke="${selected?'#2164ff':'var(--furniture-stroke)'}" stroke-width="${selected?.03:.014}" fill="none">${rect(0,0,w,d,`rx=".04" fill="${fill}" ${type==='rug'?'stroke-dasharray=".035 .04"':''}`)}${detail}${rect(-.035,-.035,w+.07,d+.07,'fill="transparent" stroke="none"')}${selected?rect(-.07,-.07,w+.14,d+.14,'fill="none" stroke="#2164ff" stroke-dasharray=".08 .05"'):''}</g>`;
}).join('');}
