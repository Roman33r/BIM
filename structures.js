export const STRUCTURE_TYPES={
 pile:{kind:'foundation',shape:'round',name:'Свайный фундамент',icon:'pile',sizes:{diameter:.3,height:2.5,material:'Бетон'}},
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
export const isRoundStructure=e=>e.kind==='foundation'&&e.type==='pile';
export const isLinearStructure=e=>isStructure(e)&&STRUCTURE_TYPES[e.type]?.shape==='line';

export function makeStructure(type,id,points){
 const spec=STRUCTURE_TYPES[type];
 const e={id,type,kind:spec.kind,name:spec.name,elevation:spec.kind==='foundation'?0:spec.sizes.height,...spec.sizes};
 const [a,b]=points;
 switch(spec.shape){
  case 'line': return {...e,a:{...a},b:{...b}};
  case 'contour': return {...e,points:points.map(p=>({...p}))};
  case 'rect': return {...e,x:a.x-e.w/2,y:a.y-e.d/2,rotation:0};
  default: return {...e,x:a.x,y:a.y};
 }
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
