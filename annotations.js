const degrees = radians => radians * 180 / Math.PI;

export function linearDimensionOffset(a,b,point) {
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
 return length?((point.y-a.y)*dx-(point.x-a.x)*dy)/length:0;
}

function angleDirections({a, vertex, b}) {
 const start = Math.atan2(a.y-vertex.y, a.x-vertex.x);
 const end = Math.atan2(b.y-vertex.y, b.x-vertex.x);
 return {start,sweep:Math.atan2(Math.sin(end-start), Math.cos(end-start))};
}

export function angleValue(dimension) {
 return Math.abs(degrees(angleDirections(dimension).sweep));
}

export function angleRadius(vertex,a,b) {
 const fromVertex=p=>Math.hypot(p.x-vertex.x,p.y-vertex.y);
 return Math.max(.05,Math.min(100,.65*Math.min(fromVertex(a),fromVertex(b))));
}

export function angleGeometry(dimension) {
 const {a,b,vertex,radius}=dimension, {start,sweep}=angleDirections(dimension);
 const pointAt = t => ({
  x:vertex.x+radius*Math.cos(start+sweep*t),
  y:vertex.y+radius*Math.sin(start+sweep*t)
 });
 const rayEnd = (p,t) => Math.hypot(p.x-vertex.x,p.y-vertex.y)>radius?p:pointAt(t);
 const middle = pointAt(.5);
 return {
  rays:[rayEnd(a,0),vertex,rayEnd(b,1)], middle,
  label:{x:middle.x+.22*Math.cos(start+sweep/2),y:middle.y+.22*Math.sin(start+sweep/2)},
  value:Math.abs(degrees(sweep)),
  arc:Array.from({length:25},(_,i)=>pointAt(i/24))
 };
}

export function angleLabel(value) {
 return value.toLocaleString('ru-RU',{maximumFractionDigits:1})+'°';
}
