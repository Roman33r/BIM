import {STRUCTURE_TYPES,rimBoardSegments,isPileCap,isRoundStructure} from './structures.js';
import {capHoleSettings} from './hardware.js';
import {FURNITURE_TYPES} from './elements.js';
const mm=v=>Number((v*1000).toFixed(2)).toLocaleString('ru-RU');
export function buildEstimate(project,floorId){
 const rows=new Map();
 for(const floor of project.floors.filter(f=>!floorId||f.id===floorId)){
  const add=(e,type=e.type||e.kind,name)=>{
   if(isPileCap(e)){const h=capHoleSettings(e);e={...e,holeCount:h.count,holeDiameter:h.diameter,holeInset:h.inset};}
   const sizes=[];
   if(e.a)sizes.push(Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y));
   if(e.points){const area=Math.abs(e.points.reduce((sum,p,i)=>{const q=e.points[(i+1)%e.points.length];return sum+p.x*q.y-q.x*p.y;},0))/2;sizes.push(area);}
   const keys=e.kind==='fastener'?['diameter','height','headDiameter','headHeight','threadPitch','ringPitch']:['diameter','bladeDiameter','bladeThickness','bladePitch','w','d','width','thickness','height','gauge','holeCount','holeDiameter','holeInset'];
   const dimensions=keys.filter(k=>typeof e[k]==='number').map(k=>[k,e[k]]),key=JSON.stringify([type,e.material||'',sizes.map(v=>+v.toFixed(6)),dimensions]);
   let size=[...(e.points?[`S ${sizes[0].toLocaleString('ru-RU',{maximumFractionDigits:3})} м²`]:sizes.map(mm)),...dimensions.filter(([k])=>!['holeCount','holeDiameter','holeInset','threadPitch','ringPitch'].includes(k)).map(([k,v])=>(k==='diameter'||k==='bladeDiameter'?'Ø':'')+mm(v))].join(' × ')+(dimensions.length?' мм':'');
   if(isRoundStructure(e))size=`Ø${mm(e.diameter)} · длина ${mm(e.height)} мм`+(e.type==='screwPile'?` · лопасть Ø${mm(e.bladeDiameter)} × ${mm(e.bladeThickness)} мм · шаг ${mm(e.bladePitch)} мм`:'');
   if(isPileCap(e))size+=` · отверстия ${e.holeCount} × Ø${mm(e.holeDiameter)} мм · отступ ${mm(e.holeInset)} мм`;
   if(e.kind==='fastener'&&(e.threadPitch||e.ringPitch))size+=` · шаг ${mm(e.threadPitch||e.ringPitch)} мм`;
   if(!rows.has(key))rows.set(key,{key,name:name||STRUCTURE_TYPES[type]?.name||FURNITURE_TYPES[type]||({wall:'Стена',slab:'Перекрытие',door:'Дверь',window:'Окно'}[type]||e.name),material:e.material||'',size,quantity:0,floors:{},price:project.estimatePrices?.[key]??null});
   const row=rows.get(key);row.quantity++;row.floors[floor.name]=(row.floors[floor.name]||0)+1;
  };
  for(const wall of floor.walls){add(wall);for(const e of wall.openings)if(e.kind==='door'||e.kind==='window')add(e,e.kind);}
  for(const e of [...floor.slabs,...floor.furniture,...floor.structures]){
   if(e.type==='rim')for(const board of rimBoardSegments(e,floor.structures))add({...e,...board,type:'rimBoard',thickness:board.thickness},'rimBoard','Доска обвязки');
   else add(e);
  }
 }
 return [...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru')||a.size.localeCompare(b.size,'ru')).map(row=>({...row,total:row.price===null?null:row.price*row.quantity}));
}
export function estimateCSV(rows){
 const cell=value=>{let s=typeof value==='number'?String(value).replace('.',','):String(value??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\ufeff'+[['Номенклатура','Размеры','Материал','Количество, шт.','Цена, ₽/шт.','Сумма, ₽','Этажи'],...rows.map(r=>[r.name,r.size,r.material,r.quantity,r.price,r.total,Object.entries(r.floors).map(([f,n])=>`${f}: ${n}`).join(', ')])].map(r=>r.map(cell).join(';')).join('\r\n');
}
