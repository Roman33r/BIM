export function segmentMeasurement(a,b){
 const dx=b.x-a.x,dy=b.y-a.y;
 return {dx,dy,distance:Math.hypot(dx,dy),angle:Math.atan2(dy,dx)*180/Math.PI};
}
export function endpointAtLength(start,direction,length){
 const dx=direction.x-start.x,dy=direction.y-start.y,distance=Math.hypot(dx,dy);
 const ux=distance>1e-9?dx/distance:1,uy=distance>1e-9?dy/distance:0;
 return {x:start.x+ux*length,y:start.y+uy*length};
}

export function rulerTicks(min,max,pixelsPerMeter){
 if(!Number.isFinite(pixelsPerMeter)||pixelsPerMeter<=0||!Number.isFinite(min)||!Number.isFinite(max)||min>=max)return [];
 const ideal=78/pixelsPerMeter;
 const base=10**Math.floor(Math.log10(ideal));
 const step=([1,2,5].find(factor=>factor*base>=ideal)??10)*base;
 const minor=step/5,ticks=[];
 for(let i=Math.ceil(min/minor-1e-10),last=Math.floor(max/minor+1e-10);i<=last;i++){
  ticks.push({value:i*minor,major:i%5===0});
 }
 return ticks;
}
