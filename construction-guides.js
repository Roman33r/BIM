export const GUIDE_STYLES={solid:'Сплошная',dashed:'Пунктирная',center:'Штрихпунктирная'};
export const guideDash=style=>({solid:'',dashed:'7 5',center:'12 4 2 4'}[style]);
export function guideStrokeSegments(guide){
 const dx=guide.b.x-guide.a.x,dy=guide.b.y-guide.a.y,length=Math.hypot(dx,dy);
 if(guide.style==='solid')return [guide.a,guide.b];
 const pattern=guide.style==='center'?[.35,.12,.035,.12]:[.2,.14],vertices=[];
 const at=distance=>({x:guide.a.x+dx*distance/length,y:guide.a.y+dy*distance/length});
 for(let distance=0,index=0;distance<length;index++){
  const next=Math.min(length,distance+pattern[index%pattern.length]);
  if(index%2===0)vertices.push(at(distance),at(next));
  distance=next;
 }
 return vertices;
}
export function guidePoints(guide){
 if(guide.type==='point')return [{x:guide.x,y:guide.y,role:'Опорная точка'}];
 const divisions=guide.divisions||1;
 return Array.from({length:divisions+1},(_,i)=>({
  x:guide.a.x+(guide.b.x-guide.a.x)*i/divisions,
  y:guide.a.y+(guide.b.y-guide.a.y)*i/divisions,
  role:i===0||i===divisions?'Конец вспомогательной линии':'Точка деления'
 }));
}
