export const STRUCTURE_TYPES={
 pile:{kind:'foundation',shape:'round',name:'Свайный фундамент',icon:'pile',sizes:{diameter:.3,height:2.5,material:'Бетон'}},
 screwPile:{kind:'foundation',shape:'round',name:'Винтовая свая',icon:'screw-pile',sizes:{diameter:.108,bladeDiameter:.3,bladePitch:.1,bladeThickness:.006,height:2.5,material:'Сталь'}},
 pileCap:{kind:'foundation',shape:'rect',name:'Оголовок сваи',icon:'pile-cap',sizes:{w:.25,d:.25,height:.02,material:'Сталь'}},
 strip:{kind:'foundation',shape:'line',name:'Ленточный фундамент',icon:'foundation',sizes:{thickness:.45,height:.65,material:'Бетон'}},
 mat:{kind:'foundation',shape:'contour',name:'Плитный фундамент',icon:'layers',sizes:{height:.3,material:'Бетон'}},
 pier:{kind:'foundation',shape:'rect',name:'Столбчатый фундамент',icon:'cube',sizes:{w:.6,d:.6,height:.8,material:'Бетон'}},
 joist:{kind:'framing',shape:'line',name:'Лага',icon:'beam',sizes:{thickness:.05,height:.2,material:'Дерево'}},
 beam:{kind:'framing',shape:'line',name:'Балка',icon:'beam',sizes:{thickness:.15,height:.25,material:'Дерево'}},
 channel:{kind:'framing',shape:'line',name:'Швеллер',icon:'channel',sizes:{thickness:.075,height:.2,gauge:.008,material:'Сталь'}},
 header:{kind:'framing',shape:'line',name:'Хидер (перемычка)',icon:'opening-beam',sizes:{thickness:.1,height:.2,material:'Дерево'}},
 ibeam:{kind:'framing',shape:'line',name:'Двутавр',icon:'ibeam',sizes:{thickness:.1,height:.2,gauge:.008,material:'Сталь'}},
 rim:{kind:'framing',shape:'line',name:'Обвязочная балка',icon:'beam',sizes:{thickness:.075,height:.225,material:'Дерево'}},
 blocking:{kind:'framing',shape:'line',name:'Распорка между лагами',icon:'beam',sizes:{thickness:.05,height:.15,material:'Дерево'}}
};

export const isStructure=e=>e.kind==='foundation'||e.kind==='framing';
export const isRoundStructure=e=>e?.kind==='foundation'&&(e.type==='pile'||e.type==='screwPile');
export const isPileCap=e=>e?.kind==='foundation'&&e.type==='pileCap';
export const pileFootprintDiameter=e=>e.type==='screwPile'?e.bladeDiameter:e.diameter;
export const isLinearStructure=e=>isStructure(e)&&STRUCTURE_TYPES[e.type]?.shape==='line';

export function makeStructure(type,id,points){
 const spec=STRUCTURE_TYPES[type];
 const e={id,type,kind:spec.kind,name:spec.name,elevation:spec.kind==='foundation'?0:spec.sizes.height,...spec.sizes};
 const [a,b]=points;
 switch(spec.shape){
  case 'line': return {...e,a:{...a},b:{...b}};
  case 'contour': return {...e,points:points.map(p=>({...p}))};
  case 'rect': return {...e,x:type==='pileCap'?a.x:a.x-e.w/2,y:type==='pileCap'?a.y:a.y-e.d/2,rotation:0};
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
 if(e.type!=='channel'&&e.type!=='ibeam')return [{width,bottom:0,top:height,offset:0}];
 return [
  {width,bottom:0,top:gauge,offset:0},
  {width,bottom:height-gauge,top:height,offset:0},
  {width:gauge,bottom:gauge,top:height-gauge,offset:e.type==='channel'?-(width-gauge)/2:0}
 ];
}
