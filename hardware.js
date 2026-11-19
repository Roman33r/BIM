export const FASTENER_TYPES={
 bolt:{kind:'fastener',shape:'fastener',name:'Болт',icon:'bolt',sizes:{diameter:.012,height:.12,headDiameter:.022,headHeight:.008,threadPitch:.00175,material:'Сталь'}},
 screw:{kind:'fastener',shape:'fastener',name:'Саморез',icon:'screw',sizes:{diameter:.006,height:.08,headDiameter:.012,headHeight:.004,threadPitch:.003,material:'Сталь'}},
 nail:{kind:'fastener',shape:'fastener',name:'Гвоздь',icon:'nail',sizes:{diameter:.004,height:.1,headDiameter:.009,headHeight:.002,material:'Сталь'}},
 anchor:{kind:'fastener',shape:'fastener',name:'Анкер',icon:'bolt',sizes:{diameter:.012,height:.12,headDiameter:.024,headHeight:.009,threadPitch:.00175,material:'Сталь'}},
 nut:{kind:'fastener',shape:'fastener',name:'Гайка',icon:'nut',sizes:{diameter:.012,height:.01,headDiameter:.022,material:'Сталь'}},
 washer:{kind:'fastener',shape:'fastener',name:'Шайба',icon:'washer',sizes:{diameter:.013,height:.0025,headDiameter:.028,material:'Сталь'}},
 ringNail:{kind:'fastener',shape:'fastener',family:'nail',name:'Ершёный гвоздь',icon:'nail',sizes:{diameter:.004,height:.09,headDiameter:.009,headHeight:.002,ringPitch:.002,material:'Сталь'}},
 spiralNail:{kind:'fastener',shape:'fastener',family:'nail',name:'Винтовой гвоздь',icon:'nail',sizes:{diameter:.004,height:.09,headDiameter:.009,headHeight:.002,threadPitch:.012,material:'Сталь'}},
 structuralScrew:{kind:'fastener',shape:'fastener',family:'screw',headStyle:'washer',name:'Конструкционный шуруп',icon:'screw',sizes:{diameter:.008,height:.16,headDiameter:.02,headHeight:.005,threadPitch:.004,material:'Сталь'}},
 lagScrew:{kind:'fastener',shape:'fastener',family:'bolt',pointed:true,name:'Шуруп-глухарь',icon:'bolt',sizes:{diameter:.01,height:.12,headDiameter:.018,headHeight:.007,threadPitch:.004,material:'Сталь'}},
 roofingScrew:{kind:'fastener',shape:'fastener',family:'bolt',pointed:true,headStyle:'washer',name:'Кровельный саморез',icon:'screw',sizes:{diameter:.006,height:.05,headDiameter:.014,headHeight:.005,threadPitch:.002,material:'Сталь'}},
 machineScrew:{kind:'fastener',shape:'fastener',family:'screw',pointed:false,name:'Винт с потайной головкой',icon:'screw',sizes:{diameter:.006,height:.04,headDiameter:.012,headHeight:.004,threadPitch:.001,material:'Сталь'}}
};
export const fastenerFamily=e=>FASTENER_TYPES[e.type]?.family||e.type;
export const isFastener=e=>e?.kind==='fastener';
export const isRingFastener=e=>e.type==='nut'||e.type==='washer';
export const fastenerRange=e=>isRingFastener(e)?[e.elevation,e.elevation+e.height]:[e.elevation-e.height,e.elevation+e.headHeight];

export function capHoleSettings(e){
 const size=Math.min(e.w,e.d);
 return {count:e.holeCount??4,diameter:e.holeDiameter??Math.min(.014,size/5),inset:e.holeInset??Math.min(.04,size/4)};
}
export function capLocalHoles(e){
 const {count,diameter,inset}=capHoleSettings(e),x=e.w/2-inset,y=e.d/2-inset;
 const positions=count===0?[]:count===2?[[-x,0],[x,0]]:[[-x,-y],[x,-y],[x,y],[-x,y]];
 if(count===8)positions.push([0,-y],[x,0],[0,y],[-x,0]);
 return positions.map(([x,y])=>({x,y,radius:diameter/2}));
}
export function capHoles(e){
 const angle=(e.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 return capLocalHoles(e).map(p=>({...p,x:e.x+p.x*c-p.y*s,y:e.y+p.x*s+p.y*c}));
}
export function validateCapHoles(e){
 const {count,diameter,inset}=capHoleSettings(e);
 if(![0,2,4,8].includes(count)||!Number.isFinite(diameter)||diameter<.003||diameter>.06||!Number.isFinite(inset)||inset<0)
  throw new Error('Проверьте количество, диаметр и отступ отверстий оголовка.');
 if(!count)return;
 if(inset<diameter/2+.002||inset>(count===2?e.w:Math.min(e.w,e.d))/2-diameter/2-.002||e.d<diameter+.004)
  throw new Error('Отверстия выходят за край оголовка. Измените отступ, диаметр или размер пластины.');
 const holes=capLocalHoles(e);
 for(let i=0;i<holes.length;i++)for(let j=i+1;j<holes.length;j++)
  if(Math.hypot(holes[i].x-holes[j].x,holes[i].y-holes[j].y)<diameter+.002-1e-9)
   throw new Error('Отверстия оголовка пересекаются. Уменьшите диаметр или отступ от края.');
}

export function capGeometry(THREE,e){
 const shape=new THREE.Shape();
 shape.moveTo(-e.w/2,-e.d/2);shape.lineTo(e.w/2,-e.d/2);shape.lineTo(e.w/2,e.d/2);shape.lineTo(-e.w/2,e.d/2);shape.closePath();
 for(const {x,y,radius} of capLocalHoles(e)){
  const hole=new THREE.Path();hole.absarc(x,y,radius,0,Math.PI*2,true);shape.holes.push(hole);
 }
 return new THREE.ExtrudeGeometry(shape,{depth:e.height,bevelEnabled:false,curveSegments:24});
}

export function fastenerObject(THREE,e,material){
 const family=fastenerFamily(e),spec=FASTENER_TYPES[e.type];
 const group=new THREE.Group(),radius=e.diameter/2,headRadius=e.headDiameter/2;
 const add=(geometry,y)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.elementId=e.id;group.add(mesh);return mesh;};
 if(isRingFastener(e)){
  const shape=new THREE.Shape();
  if(e.type==='nut'){
   for(let i=0;i<6;i++){const angle=i*Math.PI/3,x=headRadius*Math.cos(angle),y=headRadius*Math.sin(angle);i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();
  }else shape.absarc(0,0,headRadius,0,Math.PI*2,false);
  const hole=new THREE.Path();hole.absarc(0,0,radius,0,Math.PI*2,true);shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:e.height,bevelEnabled:false,curveSegments:20});geometry.rotateX(-Math.PI/2);add(geometry,0);
  return group;
 }
 const pointed=spec.pointed??(family==='screw'||family==='nail'),tip=pointed?Math.min(e.height*.2,e.diameter*2):0;
 add(new THREE.CylinderGeometry(radius*(e.threadPitch?.82:1),radius*(e.threadPitch?.82:1),e.height-tip,20),-(e.height-tip)/2);
 if(tip)add(new THREE.CylinderGeometry(radius,0,tip,20),-e.height+tip/2);
 if(family==='screw'&&spec.headStyle!=='washer')add(new THREE.CylinderGeometry(headRadius,radius,e.headHeight,24),e.headHeight/2);
 else {const geometry=new THREE.CylinderGeometry(headRadius,headRadius,e.headHeight,family==='nail'||family==='screw'?24:6);if(family==='bolt')geometry.rotateY(Math.PI/6);add(geometry,e.headHeight/2);}
 if(spec.headStyle==='washer')add(new THREE.CylinderGeometry(headRadius,headRadius,e.headHeight*.2,24),e.headHeight*.1);
 if(e.ringPitch)for(let y=-e.height*.22;y>-e.height+tip+radius;y-=e.ringPitch){const ring=new THREE.TorusGeometry(radius*.92,radius*.08,4,16);ring.rotateX(Math.PI/2);add(ring,y);}
 if(e.type==='anchor')add(new THREE.CylinderGeometry(radius,radius,e.height*.65,24),-e.height*.6);
 if(e.threadPitch){
  const ridge=radius*.09,threaded=(e.type==='anchor'?e.height*.25:e.height-tip)-2*ridge,turns=threaded/e.threadPitch;
  class ThreadCurve extends THREE.Curve{getPoint(t,target=new THREE.Vector3()){return target.set(radius*.91*Math.cos(t*turns*Math.PI*2),-ridge-t*threaded,radius*.91*Math.sin(t*turns*Math.PI*2));}}
  add(new THREE.TubeGeometry(new ThreadCurve(),Math.min(4096,Math.max(24,Math.ceil(turns*14))),radius*.09,4,false),0);
 }
 if(family==='screw'){
  const y=e.headHeight+5e-8,half=headRadius*.62,vertices=[-half,y,0,half,y,0,0,y,-half,0,y,half];
  const line=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),new THREE.LineBasicMaterial({color:0x344257}));group.add(line);
 }
 return group;
}
