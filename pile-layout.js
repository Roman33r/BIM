import {isRoundStructure} from './structures.js';

function axisPositions(min,max,step,limit){
 if(max-min<1e-8)return [min];
 const positions=[min,max],intervals=[[min,max]];
 for(let i=0;i<intervals.length;i++){
  const [a,b]=intervals[i];
  if(b-a<step-1e-8)continue;
  if(positions.length>=limit)throw new Error('В области больше '+limit+' свай. Увеличьте шаг или уменьшите область.');
  const center=(a+b)/2;
  positions.push(center);intervals.push([a,center],[center,b]);
 }
 return positions;
}

export function pileAreaPoints(a,b,step=1.5,limit=2000){
 if(!Number.isFinite(step)||step<.1||step>100)throw new Error('Шаг свай должен быть от 100 до 100 000 мм.');
 if(![a.x,a.y,b.x,b.y].every(Number.isFinite))throw new Error('Некорректные границы области.');
 const xs=axisPositions(Math.min(a.x,b.x),Math.max(a.x,b.x),step,limit);
 const ys=axisPositions(Math.min(a.y,b.y),Math.max(a.y,b.y),step,limit);
 if(xs.length*ys.length>limit)throw new Error('В области больше '+limit+' свай. Увеличьте шаг или уменьшите область.');
 const corners=[],edges=[],inside=[];
 for(const y of ys)for(const x of xs){
  const edgeX=x===xs[0]||x===xs[1],edgeY=y===ys[0]||y===ys[1];
  (edgeX&&edgeY?corners:edgeX||edgeY?edges:inside).push({x,y});
 }
 return [...corners,...edges,...inside];
}

export function selectedPileDimensions(floor,selectedIds){
 const piles=(floor.structures||[]).filter(e=>isRoundStructure(e)&&selectedIds.has(e.id));
 if(piles.length<2)return null;
 const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
 const describe=(a,b)=>{
  if(a.x>b.x||a.x===b.x&&a.y>b.y)[a,b]=[b,a];
  const length=distance(a,b);
  return {a,b,length,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
 };
 // Connect the selected centers by their shortest links, so an array stays readable.
 const connected=new Set([0]),nearest=piles.map((p,i)=>({from:0,to:i,length:i?distance(piles[0],p):Infinity})),links=[];
 while(connected.size<piles.length){
  let next=null;
  for(const candidate of nearest)if(!connected.has(candidate.to)&&(!next||candidate.length<next.length))next=candidate;
  connected.add(next.to);
  if(next.length>1e-7)links.push(describe(piles[next.from],piles[next.to]));
  for(const candidate of nearest){
   if(connected.has(candidate.to))continue;
   const length=distance(piles[next.to],piles[candidate.to]);
   if(length<candidate.length){candidate.from=next.to;candidate.length=length;}
  }
 }
 if(!links.length)return null;
 const minX=Math.min(...piles.map(p=>p.x-p.diameter/2)),maxX=Math.max(...piles.map(p=>p.x+p.diameter/2));
 const minY=Math.min(...piles.map(p=>p.y-p.diameter/2)),maxY=Math.max(...piles.map(p=>p.y+p.diameter/2));
 const overall=[];
 if(Math.max(...piles.map(p=>p.x))-Math.min(...piles.map(p=>p.x))>1e-7)
  overall.push({...describe({x:minX,y:minY},{x:maxX,y:minY}),axis:'x'});
 if(Math.max(...piles.map(p=>p.y))-Math.min(...piles.map(p=>p.y))>1e-7)
  overall.push({...describe({x:maxX,y:minY},{x:maxX,y:maxY}),axis:'y'});
 return {links,overall};
}
