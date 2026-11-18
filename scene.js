import * as THREE from './vendor/three.module.js';
import {wallLength} from './model.js';
import {buildFurniture} from './furniture-scene.js';
import {elementFrame,framePoint,elementAxes} from './transforms.js';
import {findElement} from './elements.js';
export function createScene(container,onSelect,gestures={}){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;container.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,150),group=new THREE.Group();scene.add(group);
 const hemi=new THREE.HemisphereLight(0xdce9ff,0xb6a18a,1.75);scene.add(hemi);const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-5,18,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,far:60});sun.shadow.bias=-.0005;scene.add(sun);
 const ambient=new THREE.DirectionalLight(0xcad9fc,.7);ambient.position.set(8,7,-8);scene.add(ambient);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:0xf3f5f7,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.24;ground.receiveShadow=true;scene.add(ground);
 let angle=.76,polar=.79,distance=24,dark=false,currentFloor=null,selectedId=null,section=false,raf=0,drag=null,dirty=true;
 const target=new THREE.Vector3(0,1,0),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const wallMat=new THREE.MeshStandardMaterial({color:0xf1eee7,roughness:.8});const selectedMat=new THREE.MeshStandardMaterial({color:0x6299ff,roughness:.5,transparent:true,opacity:.72});const wood=new THREE.MeshStandardMaterial({color:0xcbbda6,roughness:.85});const frame=new THREE.MeshStandardMaterial({color:0x65717b,roughness:.6});const glass=new THREE.MeshStandardMaterial({color:0xbfdce9,transparent:true,opacity:.35,roughness:.2,metalness:.15});
 function material(color){return new THREE.MeshStandardMaterial({color,roughness:.85})}
 function box(w,h,d,x,y,z,mat,id){if(w<.001||h<.001||d<.001)return;const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;if(id)mesh.userData.elementId=id;group.add(mesh);return mesh;}
 function localBox(wall,start,end,bottom,top,mat,id){const len=wallLength(wall),mid=(start+end)/2,x=wall.a.x+(wall.b.x-wall.a.x)*mid/len,z=wall.a.y+(wall.b.y-wall.a.y)*mid/len;const mesh=box(end-start,top-bottom,wall.thickness,x-6,(bottom+top)/2,z-4.5,mat,id);if(mesh)mesh.rotation.y=-Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x);}
 function build(floor,id,opts={}){
  const changedFloor=currentFloor?.id!==floor.id;currentFloor=floor;selectedId=id;dark=!!opts.dark;section=!!opts.section;
  const geometries=new Set(),materials=new Set();
  group.traverse(child=>{if(child.geometry)geometries.add(child.geometry);if(child.material&&!Array.isArray(child.material))materials.add(child.material);});
  for(const geometry of geometries)geometry.dispose();
  for(const m of materials)if(![wallMat,selectedMat,wood,frame,glass].includes(m)){m.map?.dispose();m.dispose();}
  group.clear();
  const heightLimit=section?1.15:3;
  for(const slab of floor.slabs){const shape=new THREE.Shape();slab.points.forEach((p,i)=>i?shape.lineTo(p.x-6,p.y-4.5):shape.moveTo(p.x-6,p.y-4.5));shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth:slab.thickness,bevelEnabled:false});geometry.rotateX(Math.PI/2);const mesh=new THREE.Mesh(geometry,id===slab.id?selectedMat:wood);mesh.receiveShadow=true;mesh.userData.elementId=slab.id;group.add(mesh);}

  for(const wall of floor.walls){const mat=wall.id===id?selectedMat:wallMat,len=wallLength(wall),h=section?Math.min(wall.height,heightLimit):wall.height;let cursor=0;
   for(const o of [...wall.openings].sort((a,b)=>a.position-b.position)){const start=o.position-o.width/2,end=o.position+o.width/2;localBox(wall,cursor,start,0,h,mat,wall.id);if(o.sill>0)localBox(wall,start,end,0,Math.min(o.sill,h),mat,wall.id);if(o.sill+o.height<h)localBox(wall,start,end,o.sill+o.height,h,mat,wall.id);
    if(o.kind==='window'&&o.sill<h){localBox(wall,start,end,o.sill,Math.min(o.sill+o.height,h),o.id===id?selectedMat:glass,o.id);const center=new THREE.Vector3(wall.a.x+(wall.b.x-wall.a.x)*o.position/len-6,o.sill+Math.min(o.height,h-o.sill)/2,wall.a.y+(wall.b.y-wall.a.y)*o.position/len-4.5);const direction=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x);for(const position of [start,end]){const x=wall.a.x+(wall.b.x-wall.a.x)*position/len-6,z=wall.a.y+(wall.b.y-wall.a.y)*position/len-4.5;box(.045,Math.min(o.height,h-o.sill),.045,x,center.y,z,frame,o.id);}const bar=box(o.width,.04,.06,center.x,o.sill,center.z,frame,o.id);if(bar)bar.rotation.y=-direction;const top=box(o.width,.04,.06,center.x,Math.min(o.sill+o.height,h),center.z,frame,o.id);if(top)top.rotation.y=-direction;}
    if(o.kind==='door')localBox(wall,start,end,0,Math.min(o.height,h),o.id===id?selectedMat:wood,o.id);
    cursor=end;
   }localBox(wall,cursor,len,0,h,mat,wall.id);
  }
  for(const item of floor.furniture)buildFurniture(THREE,group,item,item.id===id?selectedMat:null);
  for(const room of floor.rooms){
   const frame=elementFrame(room);if(opts.labels!==false)label(room.name,frame.center.x,.12,frame.center.y,room.id,room.id===id);
   if(room.id===id){const points=[[0,0],[frame.w,0],[frame.w,frame.h],[0,frame.h],[0,0]].map(([x,y])=>{const p=framePoint(frame,x,y);return new THREE.Vector3(p.x-6,.035,p.y-4.5);});const outline=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x2164ff}));outline.userData.elementId=room.id;group.add(outline);}
  }
  if(opts.dimensions!==false)for(const dim of floor.dimensions){const dx=dim.b.x-dim.a.x,dz=dim.b.y-dim.a.y,l=Math.hypot(dx,dz)||1,px=-dz/l*dim.offset,pz=dx/l*dim.offset;const a=new THREE.Vector3(dim.a.x+px-6,.04,dim.a.y+pz-4.5),b=new THREE.Vector3(dim.b.x+px-6,.04,dim.b.y+pz-4.5);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:dim.id===id?0x2164ff:0x8b95a3}));line.userData.elementId=dim.id;group.add(line);label(Math.round(l*1000).toLocaleString('ru-RU'),(dim.a.x+dim.b.x)/2+px,.12,(dim.a.y+dim.b.y)/2+pz,dim.id,dim.id===id);}
  const selected=findElement(floor,id);
  function guideLine(a,b,color){const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x-6,.05,a.y-4.5),new THREE.Vector3(b.x-6,.05,b.y-4.5)]),line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color,dashSize:.15,gapSize:.08,depthTest:false}));line.computeLineDistances();line.renderOrder=10;group.add(line);}
  if(opts.axes&&selected)for(const axis of elementAxes(selected.element,selected.host))guideLine({x:axis.center.x-axis.direction.x*axis.extent,y:axis.center.y-axis.direction.y*axis.extent},{x:axis.center.x+axis.direction.x*axis.extent,y:axis.center.y+axis.direction.y*axis.extent},0x2696ad);
  const guideBounds=new THREE.Box3().setFromObject(group);
  for(const guide of opts.feedback?.guides||[]){let a=guide.a,b=guide.b;if(guide.component==='x'){a={x:guide.a.x,y:guideBounds.min.z+3.5};b={x:guide.a.x,y:guideBounds.max.z+5.5};}if(guide.component==='y'){a={x:guideBounds.min.x+5,y:guide.a.y};b={x:guideBounds.max.x+7,y:guide.a.y};}guideLine(a,b,guide.axis?0x2696ad:0xbc43c5);}
  scene.background=new THREE.Color(dark?0x1b2028:0xf7f8fa);ground.material.color.set(dark?0x202833:0xf3f5f7);if(changedFloor)fitCamera();dirty=true;
 }
 function fitCamera(){const bounds=new THREE.Box3().setFromObject(group);if(bounds.isEmpty()){target.set(-6,1,-4.5);distance=24;}else{bounds.getCenter(target);const size=bounds.getSize(new THREE.Vector3());distance=Math.max(12,size.length()*1.5);}dirty=true;}
 function label(text,x,y,z,id,selected){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle=dark?'#e6edf7':'#344257';if(selected)ctx.fillStyle='#2164ff';ctx.font='500 28px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText(text,256,58);const texture=new THREE.CanvasTexture(canvas);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true}));sprite.position.set(x-6,y,z-4.5);sprite.scale.set(1.85,.35,1);sprite.userData.elementId=id;group.add(sprite);}
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
 const observer=new ResizeObserver(resize);observer.observe(container);
 function frameLoop(){raf=requestAnimationFrame(frameLoop);if(!container.clientWidth||!dirty)return;const fittedDistance=distance*Math.max(1,1.25/camera.aspect);camera.position.set(target.x+fittedDistance*Math.sin(polar)*Math.sin(angle),target.y+fittedDistance*Math.cos(polar),target.z+fittedDistance*Math.sin(polar)*Math.cos(angle));camera.lookAt(target);renderer.render(scene,camera);dirty=false;}
 function pick(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.params.Line.threshold=.08;raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(group.children,true).find(hit=>hit.object.userData.elementId);}
 function groundPoint(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const p=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());return p?{x:p.x+6,y:p.z+4.5}:null;}
 renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1)return;const hit=pick(e),point=groundPoint(e),moving=hit&&!e.shiftKey&&e.button===0&&point;drag={x:e.clientX,y:e.clientY,angle,polar,moved:false,moving:!!moving};renderer.domElement.setPointerCapture(e.pointerId);if(moving)gestures.start?.(hit.object.userData.elementId,point);else if(!hit&&!e.shiftKey)onSelect(null);});
 renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moving){if(drag.moved){const point=groundPoint(e);if(point)gestures.move?.(point,e.shiftKey,e.altKey);}}else{angle=drag.angle-dx*.007;polar=Math.max(.25,Math.min(1.47,drag.polar-dy*.005));dirty=true;}});
 renderer.domElement.addEventListener('pointerup',()=>{if(drag?.moving)gestures.end?.();drag=null;});
 renderer.domElement.addEventListener('pointercancel',()=>{if(drag?.moving)gestures.cancel?.();drag=null;});
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(10,Math.min(100,distance*Math.exp(e.deltaY*.001)));dirty=true;},{passive:false});
 frameLoop();return {update:build,resize,reset(){angle=.76;polar=.79;fitCamera();},facade(){angle=Math.PI;polar=1.47;fitCamera();},dispose(){cancelAnimationFrame(raf);observer.disconnect();renderer.dispose()}};
}
