import * as THREE from './vendor/three.module.js';
import {wallLength} from './model.js';
export function createScene(container,onSelect){
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
  currentFloor=floor;selectedId=id;dark=!!opts.dark;section=!!opts.section;
  while(group.children.length){const child=group.children[0];group.remove(child);child.geometry?.dispose();if(child.material&&!['wall','selected'].includes(child.userData.shared)&&![wallMat,selectedMat,wood,frame,glass].includes(child.material))child.material?.dispose();}
  const heightLimit=section?1.15:3;
  for(const slab of floor.slabs){const shape=new THREE.Shape();slab.points.forEach((p,i)=>i?shape.lineTo(p.x-6,p.y-4.5):shape.moveTo(p.x-6,p.y-4.5));shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth:slab.thickness,bevelEnabled:false});geometry.rotateX(Math.PI/2);const mesh=new THREE.Mesh(geometry,id===slab.id?selectedMat:wood);mesh.receiveShadow=true;mesh.userData.elementId=slab.id;group.add(mesh);}
  box(12.3,.16,2.3,0,-.07,5.65,wood);for(let i=0;i<40;i++)box(12.3,.006,.012,0,.015,4.55+i*.055,material(0xb4a68e));
  for(const wall of floor.walls){const mat=wall.id===id?selectedMat:wallMat,len=wallLength(wall),h=Math.min(wall.height,heightLimit);let cursor=0;
   for(const o of [...wall.openings].sort((a,b)=>a.position-b.position)){const start=o.position-o.width/2,end=o.position+o.width/2;localBox(wall,cursor,start,0,h,mat,wall.id);if(o.sill>0)localBox(wall,start,end,0,Math.min(o.sill,h),mat,wall.id);if(o.sill+o.height<h)localBox(wall,start,end,o.sill+o.height,h,mat,wall.id);
    if(o.kind==='window'&&o.sill<h){localBox(wall,start,end,o.sill,Math.min(o.sill+o.height,h),o.id===id?selectedMat:glass,o.id);const center=new THREE.Vector3(wall.a.x+(wall.b.x-wall.a.x)*o.position/len-6,o.sill+Math.min(o.height,h-o.sill)/2,wall.a.y+(wall.b.y-wall.a.y)*o.position/len-4.5);const direction=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x);for(const position of [start,end]){const x=wall.a.x+(wall.b.x-wall.a.x)*position/len-6,z=wall.a.y+(wall.b.y-wall.a.y)*position/len-4.5;box(.045,Math.min(o.height,h-o.sill),.045,x,center.y,z,frame,o.id);}const bar=box(o.width,.04,.06,center.x,o.sill,center.z,frame,o.id);if(bar)bar.rotation.y=-direction;const top=box(o.width,.04,.06,center.x,Math.min(o.sill+o.height,h),center.z,frame,o.id);if(top)top.rotation.y=-direction;}
    cursor=end;
   }localBox(wall,cursor,len,0,h,mat,wall.id);
  }
  // Simplified furniture gives the model a readable architectural scale.
  const fabric=material(0xe9e5dc),metal=material(0x6b7279);
  box(2.9,.45,.95,-3.45,.36,2, fabric);box(2.9,.5,.2,-3.45,.73,1.6,fabric);box(.18,.4,.95,-4.87,.6,2,fabric);box(.18,.4,.95,-2.03,.6,2,fabric);box(1.4,.08,.7,-3.45,.43,3.15,wood);
  box(1.7,.08,.95,3.45,.77,2.7,wood);for(const dx of [-.7,.7])for(const dz of [-.34,.34])box(.06,.75,.06,3.45+dx,.37,2.7+dz,metal);
  for(const dx of [-.52,.52])for(const dz of [-.8,.8]){box(.44,.09,.45,3.45+dx,.45,2.7+dz,fabric);box(.44,.6,.06,3.45+dx,.72,2.7+dz+Math.sign(dz)*.2,wood);}
  box(3.4,.88,.65,3.95,.44,-3.94,material(0xf3f1ea));box(3.4,.05,.67,3.95,.91,-3.94,wood);box(.65,.88,1.75,5.28,.44,-2.75,material(0xf3f1ea));box(.66,.05,1.77,5.28,.91,-2.75,wood);
  box(1.6,.07,.7,-4.1,.77,-3.5,wood);box(.07,.73,.6,-4.8,.36,-3.5,wood);box(.07,.73,.6,-3.4,.36,-3.5,wood);box(.55,.09,.55,-4.1,.43,-2.6,fabric);
  for(let i=0;i<14;i++)box(1.1,(i+1)*.18,.225,.9,(i+1)*.09,-1.1-i*.225,wood);
  box(1.55,.08,.95,3.3,.76,5.65,wood);for(const x of [2.7,3.9]){box(.4,.08,.45,x,.45,4.85,fabric);box(.4,.08,.45,x,.45,6.45,fabric);}
  for(const [x,z] of [[-5.5,5.8],[5.5,5.8],[-5.4,3.7]]){box(.32,.35,.32,x,.17,z,material(0xc5c4ba));const leaves=new THREE.Mesh(new THREE.SphereGeometry(.28,8,7),material(0x8c9f78));leaves.position.set(x,.62,z);leaves.scale.set(.8,1.4,.8);group.add(leaves);}
  scene.background=new THREE.Color(dark?0x1b2028:0xf7f8fa);ground.material.color.set(dark?0x202833:0xf3f5f7);dirty=true;
 }
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
 const observer=new ResizeObserver(resize);observer.observe(container);
 function frameLoop(){raf=requestAnimationFrame(frameLoop);if(!container.clientWidth||!dirty)return;const fittedDistance=distance*Math.max(1,1.25/camera.aspect);camera.position.set(target.x+fittedDistance*Math.sin(polar)*Math.sin(angle),target.y+fittedDistance*Math.cos(polar),target.z+fittedDistance*Math.sin(polar)*Math.cos(angle));camera.lookAt(target);renderer.render(scene,camera);dirty=false;}
 renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,angle,polar,moved:false};renderer.domElement.setPointerCapture(e.pointerId)});
 renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;angle=drag.angle-dx*.007;polar=Math.max(.25,Math.min(1.47,drag.polar-dy*.005));dirty=true;});
 renderer.domElement.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(group.children).find(item=>item.object.userData.elementId);onSelect(hit?.object.userData.elementId||null);}drag=null;});
 renderer.domElement.addEventListener('pointercancel',()=>{drag=null});renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(10,Math.min(60,distance*Math.exp(e.deltaY*.001)));dirty=true;},{passive:false});
 frameLoop();return {update:build,resize,reset(){angle=.76;polar=.79;distance=24;target.set(0,1,0);dirty=true},facade(){angle=Math.PI;polar=1.47;distance=24;dirty=true},dispose(){cancelAnimationFrame(raf);observer.disconnect();renderer.dispose()}};
}
