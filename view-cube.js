import {VIEW_PRESETS} from './views.js';

const opposite={top:'bottom',bottom:'top',front:'back',back:'front',left:'right',right:'left'};
const faces={top:{label:'ВЕРХ',normal:[0,1,0],points:[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]]},bottom:{label:'НИЗ',normal:[0,-1,0],points:[[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]]},front:{label:'ПЕРЕД',normal:[0,0,1],points:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]},back:{label:'ЗАД',normal:[0,0,-1],points:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]},left:{label:'ЛЕВО',normal:[-1,0,0],points:[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]},right:{label:'ПРАВО',normal:[1,0,0],points:[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]}};
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
export function cubeMarkup(view='orbit',pose={angle:.76,polar:.79}){
 const direction=VIEW_PRESETS[view]?.direction||[Math.sin(pose.polar)*Math.sin(pose.angle),Math.cos(pose.polar),Math.sin(pose.polar)*Math.cos(pose.angle)],up=VIEW_PRESETS[view]?.up||[0,1,0];
 const right=unit(cross(up,direction)),screenUp=cross(direction,right),project=(p,size=19)=>({x:68+dot(p,right)*size,y:64-dot(p,screenUp)*size});
 const visible=Object.entries(faces).filter(([,f])=>dot(f.normal,direction)>1e-6).sort((a,b)=>dot(a[1].normal,direction)-dot(b[1].normal,direction));
 let html='<svg viewBox="0 0 136 143" aria-label="Куб ориентации">';
 for(const [key,f] of visible){
  const center=project(f.normal),points=f.points.map(p=>project(p));
  html+=`<g role="button" tabindex="0" data-cube-view="${key}" aria-label="${VIEW_PRESETS[key].name}" class="cube-face cube-face-${key}${key===view?' active':''}"><title>${VIEW_PRESETS[key].name}</title><polygon points="${points.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}"/><text x="${center.x}" y="${center.y+2}" text-anchor="middle">${f.label}</text></g>`;
 }
 for(const [key,f] of Object.entries(faces)){
  const p=project(f.normal,52);if(Math.hypot(p.x-68,p.y-64)<15)continue;
  const axis=Math.abs(f.normal[0])?'x':Math.abs(f.normal[1])?'z':'y',positive=f.normal.some(v=>v>0),label=(positive?'':'−')+axis.toUpperCase();
  const base=project(f.normal,40);
  html+=`<g role="button" tabindex="0" data-cube-view="${key}" aria-label="${VIEW_PRESETS[key].name}" class="cube-axis cube-axis-${axis}${positive?' positive':''}${key===view?' active':''}"><title>${VIEW_PRESETS[key].name}</title><path d="M${base.x} ${base.y}L${p.x} ${p.y}"/><circle cx="${p.x}" cy="${p.y}" r="10"/><text x="${p.x}" y="${p.y+3.5}" text-anchor="middle">${label}</text></g>`;
 }
 if(opposite[view])html+=`<g role="button" tabindex="0" data-cube-view="${opposite[view]}" aria-label="${VIEW_PRESETS[opposite[view]].name}" class="cube-opposite"><title>Противоположный вид: ${VIEW_PRESETS[opposite[view]].name}</title><rect x="112" y="122" width="23" height="20" rx="4"/><text x="123.5" y="136" text-anchor="middle">↔</text></g>`;
 return html+'</svg>';
}
export function createViewCube(element,{plan=false,onView}){
 let current=plan?'top':'orbit',pose={angle:.76,polar:.79},signature='';
 const render=()=>{
  const next=`${current}:${pose.angle.toFixed(3)}:${pose.polar.toFixed(3)}`;if(next===signature)return;signature=next;
  element.innerHTML=cubeMarkup(current,pose)+`<button type="button" class="cube-home" data-cube-view="${plan?'top':'orbit'}" aria-label="${plan?'Вид сверху':'Общий вид'}" title="${plan?'Вид сверху':'Общий вид'}">⌂</button><span class="cube-caption">${VIEW_PRESETS[current]?.name||'Общий вид'}</span>`;
  element.dataset.view=current;
 };
 element.addEventListener('click',event=>{const target=event.target.closest('[data-cube-view]');if(target){event.preventDefault();onView(target.dataset.cubeView);}});
 element.addEventListener('keydown',event=>{
  const arrows={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'top',ArrowDown:'bottom'};
  if(arrows[event.key]){event.preventDefault();event.stopPropagation();onView(arrows[event.key]);}
  else if(['Enter',' '].includes(event.key)){const target=event.target.closest('[data-cube-view]');if(target){event.preventDefault();event.stopPropagation();onView(target.dataset.cubeView);}}
 });
 render();return {setView(view,nextPose){current=view;if(nextPose)pose=nextPose;render();}};
}
