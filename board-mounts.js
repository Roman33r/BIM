import {capHoles,isRingFastener} from './hardware.js';
import {makeStructure,isPileCap} from './structures.js';

export function boardMountPoints(board,members){
 return (board.mounts||[]).map(mount=>{
  const cap=members.find(e=>e.id===mount.capId&&isPileCap(e)),point=cap&&capHoles(cap)[mount.holeIndex];
  if(!point)throw new Error('Отверстие крепления доски не найдено. Сначала отсоедините доску от оголовка.');
  return {...mount,point,cap};
 });
}
export function syncBoardMounts(floor){
 for(const board of floor.structures||[]){
  if(board.mounts===undefined)continue;
  if(board.type!=='rimBoard'||!Array.isArray(board.mounts)||board.mounts.length>2||new Set(board.mounts.map(m=>m?.end)).size!==board.mounts.length
   ||board.mounts.some(m=>!m||!['a','b'].includes(m.end)||typeof m.capId!=='string'||!Number.isInteger(m.holeIndex)||m.holeIndex<0||m.holeIndex>7))throw new Error('Некорректное крепление доски.');
  if(!board.mounts.length){delete board.mounts;continue;}
  const mounts=boardMountPoints(board,floor.structures),a=mounts.find(m=>m.end==='a')?.point||board.a,b=mounts.find(m=>m.end==='b')?.point||board.b;
  if(mounts.some(m=>m.point.radius>=board.thickness/2-.002))throw new Error('Отверстие крепления шире доски.');
  const length=Math.hypot(b.x-a.x,b.y-a.y);
  if(length<.05)throw new Error('Точки крепления доски слишком близко.');
  if(mounts.some(m=>Math.abs(m.cap.elevation-mounts[0].cap.elevation)>1e-5))throw new Error('Для крепления доски оголовки должны быть на одной отметке.');
  const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,overhang=.05;
  if(mounts.some(m=>m.end==='a'))board.a={x:a.x-ux*overhang,y:a.y-uy*overhang};
  if(mounts.some(m=>m.end==='b'))board.b={x:b.x+ux*overhang,y:b.y+uy*overhang};
  board.elevation=mounts[0].cap.elevation+board.height;
  if(Math.hypot(board.b.x-board.a.x,board.b.y-board.a.y)>100||[board.a.x,board.a.y,board.b.x,board.b.y].some(v=>!Number.isFinite(v)||Math.abs(v)>1000)||board.elevation>100)throw new Error('Доска выходит за допустимые размеры проекта.');
 }
}
export function boardGeometry(THREE,board,members){
 const length=Math.hypot(board.b.x-board.a.x,board.b.y-board.a.y),ux=(board.b.x-board.a.x)/length,uy=(board.b.y-board.a.y)/length;
 const shape=new THREE.Shape();shape.moveTo(0,-board.thickness/2);shape.lineTo(length,-board.thickness/2);shape.lineTo(length,board.thickness/2);shape.lineTo(0,board.thickness/2);shape.closePath();
 for(const {point} of boardMountPoints(board,members)){
  if(point.radius>=board.thickness/2-.002)throw new Error('Отверстие крепления шире доски.');
  const dx=point.x-board.a.x,dy=point.y-board.a.y,hole=new THREE.Path();hole.absarc(dx*ux+dy*uy,-dx*uy+dy*ux,point.radius,0,Math.PI*2,true);shape.holes.push(hole);
 }
 return new THREE.ExtrudeGeometry(shape,{depth:board.height,bevelEnabled:false,curveSegments:20});
}
export function boardFasteners(board,members,type,idFactory){
 return boardMountPoints(board,members).map(({point,cap})=>{
  const e=makeStructure(type,idFactory(),[point]);e.elevation=board.elevation;
  if(!isRingFastener(e)){
   if(e.diameter>point.radius*2+1e-9)throw new Error('Крепёж шире отверстия оголовка.');
   e.height=Math.max(e.height,board.height+cap.height+.015);
  }
  return e;
 });
}
