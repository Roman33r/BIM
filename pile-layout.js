import {isRoundStructure} from './structures.js';

function axisPositions(min,max,step){
 const center=(min+max)/2,half=(max-min)/2,positions=[min,center,max];
 const count=Math.ceil(half/step)-1;
 if(count>1000)throw new Error('Слишком большая область. Увеличьте шаг свай.');
 for(let i=1;i<=count;i++)positions.push(center-i*step,center+i*step);
 return positions.sort((a,b)=>a-b).filter((value,i,array)=>!i||value-array[i-1]>1e-7);
}

export function pileAreaPoints(a,b,step=1.5,limit=2000){
 if(!Number.isFinite(step)||step<.1||step>100)throw new Error('Шаг свай должен быть от 100 до 100 000 мм.');
 if(![a.x,a.y,b.x,b.y].every(Number.isFinite))throw new Error('Некорректные границы области.');
 const xs=axisPositions(Math.min(a.x,b.x),Math.max(a.x,b.x),step);
 const ys=axisPositions(Math.min(a.y,b.y),Math.max(a.y,b.y),step);
 if(xs.length*ys.length>limit)throw new Error('В области больше '+limit+' свай. Увеличьте шаг или уменьшите область.');
 return ys.flatMap(y=>xs.map(x=>({x,y})));
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
 let farthest=null;
 for(let i=0;i<piles.length;i++)for(let j=i+1;j<piles.length;j++){
  const length=distance(piles[i],piles[j]);
  if(!farthest||length>farthest.length)farthest={a:piles[i],b:piles[j],length};
 }
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
 if(!farthest||farthest.length<1e-7)return null;
 let {a,b}=farthest;
 if(a.x>b.x||a.x===b.x&&a.y>b.y)[a,b]=[b,a];
 const overall=describe(a,b),ux=(b.x-a.x)/overall.length,uy=(b.y-a.y)/overall.length;
 overall.a={x:a.x-ux*a.diameter/2,y:a.y-uy*a.diameter/2};
 overall.b={x:b.x+ux*b.diameter/2,y:b.y+uy*b.diameter/2};
 overall.length+=(a.diameter+b.diameter)/2;
 return {links,overall};
}
