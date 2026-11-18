import {wallSegments} from './model.js';
import {elementFrame,framePoint,sub,dot} from './transforms.js';

function clipSegment(a,b,{frame,start,end}) {
 const local = p => ({x:dot(sub(p,frame.origin),frame.u),y:dot(sub(p,frame.origin),frame.v)});
 const p=local(a), q=local(b);
 let min=0, max=1;
 for(const [key,lower,upper] of [['x',start,end],['y',0,frame.h]]){
  const delta=q[key]-p[key];
  if(Math.abs(delta)<1e-9){
   if(p[key]<lower-1e-8||p[key]>upper+1e-8)return null;
   continue;
  }
  const enter=(lower-p[key])/delta, exit=(upper-p[key])/delta;
  min=Math.max(min,Math.min(enter,exit));max=Math.min(max,Math.max(enter,exit));
  if(max-min<1e-6)return null;
 }
 return [min,max];
}

function pointBetween(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}

export function hiddenWallEnds(walls) {
 const solids = walls.map(wall=>{
  const frame=elementFrame(wall),half=frame.h/2;
  return {wall,frame,segments:wallSegments(wall),
   left:Math.min(wall.a.x,wall.b.x)-half,right:Math.max(wall.a.x,wall.b.x)+half,
   top:Math.min(wall.a.y,wall.b.y)-half,bottom:Math.max(wall.a.y,wall.b.y)+half};
 });
 const ends=[];
 for(const {wall,frame} of solids){
  for(const atStart of [true,false]){
   const x=atStart?0:frame.w, direction=atStart?1:-1;
   const a=framePoint(frame,x,0), b=framePoint(frame,x,frame.h);
   const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
   const candidates=[];
   for(const other of solids){
    if(other.wall===wall||right<other.left||left>other.right||bottom<other.top||top>other.bottom)continue;
    for(const [start,end] of other.segments){
     const solid={frame:other.frame,start,end};
     const intersection=clipSegment(a,b,solid);
     if(!intersection)continue;
     const middle=pointBetween(a,b,(intersection[0]+intersection[1])/2);
     const local=sub(middle,solid.frame.origin), along=dot(local,solid.frame.u), across=dot(local,solid.frame.v);
     // A shared outer edge is visible, including at a flush butt joint.
     if(along>start+1e-6&&along<end-1e-6&&across>1e-6&&across<solid.frame.h-1e-6)candidates.push({solid,intersection});
    }
   }
   if(!candidates.length)continue;
   const strokes=[];
   for(const {intersection} of candidates)strokes.push([pointBetween(a,b,intersection[0]),pointBetween(a,b,intersection[1])]);
   const sideLength=Math.min(frame.w,Math.max(.3,frame.h*3));
   for(const y of [0,frame.h]){
    const start=framePoint(frame,x,y), end=framePoint(frame,x+direction*sideLength,y);
    const overlap=candidates.map(({solid})=>clipSegment(start,end,solid)).filter(segment=>segment&&segment[0]<1e-6);
    if(overlap.length)strokes.push([start,pointBetween(start,end,Math.max(...overlap.map(segment=>segment[1])))]);
   }
   ends.push({id:wall.id,strokes});
  }
 }
 return ends;
}
