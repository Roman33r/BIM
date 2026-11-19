import {FASTENER_TYPES} from './hardware.js';
export const STRUCTURE_TYPES={
 pile:{kind:'foundation',shape:'round',name:'Свайный фундамент',icon:'pile',sizes:{diameter:.3,height:2.5,material:'Бетон'}},
 screwPile:{kind:'foundation',shape:'round',name:'Винтовая свая',icon:'screw-pile',sizes:{diameter:.108,bladeDiameter:.3,bladePitch:.1,bladeThickness:.006,height:2.5,material:'Сталь'}},
 pileCap:{kind:'foundation',shape:'rect',name:'Оголовок сваи',icon:'pile-cap',sizes:{w:.25,d:.25,height:.02,holeCount:4,holeDiameter:.014,holeInset:.04,material:'Сталь'}},
 strip:{kind:'foundation',shape:'line',name:'Ленточный фундамент',icon:'foundation',sizes:{thickness:.45,height:.65,material:'Бетон'}},
 mat:{kind:'foundation',shape:'contour',name:'Плитный фундамент',icon:'layers',sizes:{height:.3,material:'Бетон'}},
 pier:{kind:'foundation',shape:'rect',name:'Столбчатый фундамент',icon:'cube',sizes:{w:.6,d:.6,height:.8,material:'Бетон'}},
 joist:{kind:'framing',shape:'line',name:'Лага',icon:'beam',sizes:{thickness:.05,height:.2,material:'Дерево'}},
 beam:{kind:'framing',shape:'line',name:'Балка',icon:'beam',sizes:{thickness:.15,height:.25,material:'Дерево'}},
 channel:{kind:'framing',shape:'line',name:'Швеллер',icon:'channel',sizes:{thickness:.075,height:.2,gauge:.008,material:'Сталь'}},
 header:{kind:'framing',shape:'line',name:'Хидер (перемычка)',icon:'opening-beam',sizes:{thickness:.1,height:.2,material:'Дерево'}},
 ibeam:{kind:'framing',shape:'line',name:'Двутавр',icon:'ibeam',sizes:{thickness:.1,height:.2,gauge:.008,material:'Сталь'}},
 rim:{kind:'framing',shape:'line',name:'Обвязочная балка',icon:'beam',sizes:{thickness:.15,height:.2,material:'Дерево'}},
 blocking:{kind:'framing',shape:'line',name:'Распорка между лагами',icon:'beam',sizes:{thickness:.05,height:.15,material:'Дерево'}},
 ...FASTENER_TYPES
};

export const isStructure=e=>e.kind==='foundation'||e.kind==='framing'||e.kind==='fastener';
export const isRoundStructure=e=>e?.kind==='foundation'&&(e.type==='pile'||e.type==='screwPile');
export const isPileCap=e=>e?.kind==='foundation'&&e.type==='pileCap';
export const pileFootprintDiameter=e=>e.type==='screwPile'?e.bladeDiameter:e.diameter;
export const isLinearStructure=e=>isStructure(e)&&STRUCTURE_TYPES[e.type]?.shape==='line';

export function makeStructure(type,id,points){
 const spec=STRUCTURE_TYPES[type];
 const e={id,type,kind:spec.kind,name:spec.name,elevation:spec.kind==='framing'?spec.sizes.height:0,...spec.sizes};
 const [a,b]=points;
 switch(spec.shape){
  case 'line': return {...e,a:{...a},b:{...b}};
  case 'contour': return {...e,points:points.map(p=>({...p}))};
  case 'rect': return {...e,x:type==='pileCap'?a.x:a.x-e.w/2,y:type==='pileCap'?a.y:a.y-e.d/2,rotation:0};
  case 'fastener':return {...e,x:a.x,y:a.y,rotation:0,showAxes:false};
  default: return {...e,x:a.x,y:a.y};
 }
}
export function pileCapFor(floor,pileId){
 return floor.structures?.find(e=>isPileCap(e)&&e.pileId===pileId);
}
export function linkedPileSelection(floor,ids,includeHosts=true){
 const selected=new Set(ids),caps=(floor.structures||[]).filter(e=>isPileCap(e)&&e.pileId!==undefined);
 if(includeHosts)for(const cap of caps)if(selected.has(cap.id))selected.add(cap.pileId);
 for(const cap of caps)if(selected.has(cap.pileId))selected.add(cap.id);
 return selected;
}

export function syncPileCaps(floor){
 const piles=new Map((floor.structures||[]).filter(isRoundStructure).map(e=>[e.id,e]));
 for(const cap of floor.structures||[]){
  if(!isPileCap(cap)||cap.pileId===undefined)continue;
  const pile=piles.get(cap.pileId);
  if(pile){cap.x=pile.x;cap.y=pile.y;cap.elevation=pile.elevation+cap.height;}
 }
}

export function screwTipHeight(e){return Math.min(e.diameter*.9,e.height*.24);}

export function screwBladeMesh(e){
 const tip=screwTipHeight(e),start=tip+Math.min(e.diameter*.68,(e.height-tip-e.bladePitch-e.bladeThickness)*.45);
 const vertices=[],indices=[],segments=48;
 const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
 for(let i=0;i<=segments;i++){
  const t=i/segments,angle=t*Math.PI*2,y=start+e.bladePitch*t;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  for(const [radius,z] of [[e.diameter/2,y],[e.bladeDiameter/2,y],[e.bladeDiameter/2,y+e.bladeThickness],[e.diameter/2,y+e.bladeThickness]]){
   vertices.push(radius*cos,z,radius*sin);
  }
  if(i===segments)break;
  const j=4*i,k=j+4;
  quad(j,j+1,k+1,k);quad(j+3,k+3,k+2,j+2);
  quad(j+1,j+2,k+2,k+1);quad(j,k,k+3,j+3);
 }
 const last=segments*4;
 quad(0,3,2,1);quad(last,last+1,last+2,last+3);
 return {vertices,indices};
}

// Width is measured across the member. The returned rectangles describe the profile
// from its bottom, with offsets referenced to the plan centerline.
export function memberProfile(e){
 const {thickness:width,height,gauge}=e;
 if(e.type==='rim')return Array.from({length:3},(_,i)=>({width:width/3,bottom:0,top:height,offset:(i-1)*width/3}));
 if(e.type!=='channel'&&e.type!=='ibeam')return [{width,bottom:0,top:height,offset:0}];
 return [
  {width,bottom:0,top:gauge,offset:0},
  {width,bottom:height-gauge,top:height,offset:0},
  {width:gauge,bottom:gauge,top:height-gauge,offset:e.type==='channel'?-(width-gauge)/2:0}
 ];
}

// The editable segment follows the package centerline. At perpendicular corners,
// stagger the board ends so the two packages meet without occupying the same volume.
export function rimBoardSegments(e,members=[]){
 const length=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y);
 if(length<1e-8)return [];
 const ux=(e.b.x-e.a.x)/length,uy=(e.b.y-e.a.y)/length;
 const others=members.filter(other=>other.type==='rim'&&other.id!==e.id);
 const direction=(a,b)=>{const d=Math.hypot(b.x-a.x,b.y-a.y);return {x:(b.x-a.x)/d,y:(b.y-a.y)/d,length:d};};
 const orientation=v=>(Math.atan2(v.y,v.x)+Math.PI)%Math.PI;
 const cutAt=(point,index)=>{
  const corners=[],tees=[];
  for(const other of others){
   const dir=direction(other.a,other.b);
   if(length<=2*other.thickness||Math.abs(ux*dir.x+uy*dir.y)>1e-6)continue;
   const endpoint=[other.a,other.b].find(p=>Math.hypot(p.x-point.x,p.y-point.y)<1e-6);
   if(endpoint){
    const away=direction(endpoint,endpoint===other.a?other.b:other.a);
    const row=(-uy*away.x+ux*away.y)>0?index:2-index;
    const owner=orientation({x:ux,y:uy})<orientation(away);
    corners.push(-other.thickness/2+(row+(owner?0:1))*other.thickness/3);
   }else{
    const along=(point.x-other.a.x)*dir.x+(point.y-other.a.y)*dir.y;
    const across=(point.x-other.a.x)*dir.y-(point.y-other.a.y)*dir.x;
    if(along>1e-6&&along<dir.length-1e-6&&Math.abs(across)<1e-6)tees.push(other.thickness/2);
   }
  }
  return corners.length===1?corners[0]:!corners.length&&tees.length===1?tees[0]:0;
 };
 return memberProfile(e).map((profile,i)=>{
  const start=cutAt(e.a,i),end=length-cutAt(e.b,i),offset=profile.offset;
  const point=t=>({x:e.a.x+ux*t-uy*offset,y:e.a.y+uy*t+ux*offset});
  return {a:point(start),b:point(end),thickness:profile.width,bottom:profile.bottom,top:profile.top};
 });
}
