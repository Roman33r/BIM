import * as THREE from './vendor/three.module.js';
import {wallLength} from './model.js';
import {buildFurniture} from './furniture-scene.js';
import {elementFrame,framePoint,elementAxes,transformHandles} from './transforms.js';
import {axisElements,elementVisible,selectionBounds,showSelectionBox} from './selection.js';
import {icon} from './icons.js';
import {findElement} from './elements.js';
import {angleGeometry,angleLabel} from './annotations.js';
import {createMaterialTexture,materialSpec} from './materials.js';
export function createScene(container,onSelect,gestures={}){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;container.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,2000),group=new THREE.Group();const overlays=new THREE.Group();
 scene.add(group,overlays);
 const marquee=document.createElement('div');
 marquee.className='selection-marquee';marquee.hidden=true;marquee.setAttribute('aria-hidden','true');
 const rotationButton=document.createElement('button');
 rotationButton.type='button';rotationButton.className='scene-rotation-handle';rotationButton.hidden=true;
 rotationButton.setAttribute('aria-label','Повернуть элемент в 3D');
 rotationButton.title='Потяните, чтобы повернуть элемент';
 rotationButton.innerHTML=icon('rotate');
 container.append(marquee,rotationButton);
 const hemi=new THREE.HemisphereLight(0xdce9ff,0xb6a18a,1.75);scene.add(hemi);const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-5,18,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,far:60});sun.shadow.bias=-.0005;scene.add(sun);
 const ambient=new THREE.DirectionalLight(0xcad9fc,.7);ambient.position.set(8,7,-8);scene.add(ambient);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:0xf3f5f7,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.24;ground.receiveShadow=true;scene.add(ground);
 let angle=.76,polar=.79,distance=24,dark=false,currentFloor=null,activeGroup=null,floorLayout='',rotationTarget=null,section=false,raf=0,drag=null,dirty=true;
 const target=new THREE.Vector3(0,1,0),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const selectedMat=new THREE.MeshStandardMaterial({color:0x6299ff,roughness:.5,transparent:true,opacity:.72});
 const frame=new THREE.MeshStandardMaterial({color:0x65717b,roughness:.6});
 const glass=new THREE.MeshStandardMaterial({color:0xbfdce9,transparent:true,opacity:.35,roughness:.2,metalness:.15});
 const textures=new Map(),surfaceMaterials=new Map(),sharedMaterials=new Set([selectedMat,frame,glass]);
 function material(name,selected){
  const spec=materialSpec(name),key=spec.id+(selected?'-selected':'');
  if(!surfaceMaterials.has(key)){
   if(!textures.has(spec.id))textures.set(spec.id,createMaterialTexture(THREE,spec));
   const surface=new THREE.MeshStandardMaterial({map:textures.get(spec.id),roughness:.84});
   if(selected){surface.color.set(0x9cbaff);surface.emissive.set(0x194aab);surface.emissiveIntensity=.6;}
   surfaceMaterials.set(key,surface);sharedMaterials.add(surface);
  }
  return surfaceMaterials.get(key);
 }
 function box(layer,w,h,d,x,y,z,mat,id){
  if(w<.001||h<.001||d<.001)return;
  const geometry=new THREE.BoxGeometry(w,h,d);
  if(mat.map){
   const uv=geometry.attributes.uv;
   [[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]].forEach(([width,height],face)=>{
    for(let i=face*4;i<face*4+4;i++)uv.setXY(i,uv.getX(i)*width,uv.getY(i)*height);
   });
  }
  const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
  if(id)mesh.userData.elementId=id;layer.add(mesh);return mesh;
 }
 function localBox(layer,wall,start,end,bottom,top,mat,id){const len=wallLength(wall),mid=(start+end)/2,x=wall.a.x+(wall.b.x-wall.a.x)*mid/len,z=wall.a.y+(wall.b.y-wall.a.y)*mid/len;const mesh=box(layer,end-start,top-bottom,wall.thickness,x-6,(bottom+top)/2,z-4.5,mat,id);if(mesh)mesh.rotation.y=-Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x);}
 function buildLevel(layer,floor,ids,opts,annotate){
  const heightLimit=1.15;
  for(const slab of floor.slabs){const shape=new THREE.Shape();slab.points.forEach((p,i)=>i?shape.lineTo(p.x-6,p.y-4.5):shape.moveTo(p.x-6,p.y-4.5));shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth:slab.thickness,bevelEnabled:false});geometry.rotateX(Math.PI/2);const mesh=new THREE.Mesh(geometry,material(slab.material,ids.has(slab.id)));mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.elementId=slab.id;layer.add(mesh);}

  for(const wall of floor.walls){const mat=material(wall.material,ids.has(wall.id)),len=wallLength(wall),h=section?Math.min(wall.height,heightLimit):wall.height;let cursor=0;
   for(const o of [...wall.openings].sort((a,b)=>a.position-b.position)){const start=o.position-o.width/2,end=o.position+o.width/2;localBox(layer,wall,cursor,start,0,h,mat,wall.id);if(o.sill>0)localBox(layer,wall,start,end,0,Math.min(o.sill,h),mat,wall.id);if(o.sill+o.height<h)localBox(layer,wall,start,end,o.sill+o.height,h,mat,wall.id);
    if(o.kind==='window'&&o.sill<h){localBox(layer,wall,start,end,o.sill,Math.min(o.sill+o.height,h),ids.has(o.id)?selectedMat:glass,o.id);const center=new THREE.Vector3(wall.a.x+(wall.b.x-wall.a.x)*o.position/len-6,o.sill+Math.min(o.height,h-o.sill)/2,wall.a.y+(wall.b.y-wall.a.y)*o.position/len-4.5);const direction=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x);for(const position of [start,end]){const x=wall.a.x+(wall.b.x-wall.a.x)*position/len-6,z=wall.a.y+(wall.b.y-wall.a.y)*position/len-4.5;box(layer,.045,Math.min(o.height,h-o.sill),.045,x,center.y,z,frame,o.id);}const bar=box(layer,o.width,.04,.06,center.x,o.sill,center.z,frame,o.id);if(bar)bar.rotation.y=-direction;const top=box(layer,o.width,.04,.06,center.x,Math.min(o.sill+o.height,h),center.z,frame,o.id);if(top)top.rotation.y=-direction;}
    if(o.kind==='door')localBox(layer,wall,start,end,0,Math.min(o.height,h),material('Дерево',ids.has(o.id)),o.id);
    cursor=end;
   }localBox(layer,wall,cursor,len,0,h,mat,wall.id);
  }
  for(const item of floor.furniture)buildFurniture(THREE,layer,item,ids.has(item.id)?selectedMat:null);
  if(!annotate)return;
  for(const room of floor.rooms){
   const frame=elementFrame(room);if(opts.labels!==false)label(layer,room.name,frame.center.x,.12,frame.center.y,room.id,ids.has(room.id));
   if(ids.has(room.id)){const points=[[0,0],[frame.w,0],[frame.w,frame.h],[0,frame.h],[0,0]].map(([x,y])=>{const p=framePoint(frame,x,y);return new THREE.Vector3(p.x-6,.035,p.y-4.5);});const outline=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x2164ff}));outline.userData.elementId=room.id;layer.add(outline);}
  }
  if(opts.dimensions!==false)for(const dim of floor.dimensions){
   const selected=ids.has(dim.id);
   const lineMaterial=new THREE.LineBasicMaterial({color:selected?0x2164ff:0x8b95a3});
   const draw=points=>{
    const vertices=points.map(p=>new THREE.Vector3(p.x-6,.04,p.y-4.5));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),lineMaterial);
    line.userData.elementId=dim.id;layer.add(line);
   };
   if(dim.mode==='angle'){
    const geometry=angleGeometry(dim);draw(geometry.rays);draw(geometry.arc);
    label(layer,angleLabel(geometry.value),geometry.label.x,.12,geometry.label.y,dim.id,selected);
   }else{
    const dx=dim.b.x-dim.a.x,dz=dim.b.y-dim.a.y,l=Math.hypot(dx,dz)||1,px=-dz/l*dim.offset,pz=dx/l*dim.offset;
    draw([dim.a,dim.b].map(p=>({x:p.x+px,y:p.y+pz})));
    label(layer,Math.round(l*1000).toLocaleString('ru-RU'),(dim.a.x+dim.b.x)/2+px,.12,(dim.a.y+dim.b.y)/2+pz,dim.id,selected);
   }
  }
 }
 function clearLayers(){
  const geometries=new Set(),materials=new Set();
  for(const layer of [group,overlays])layer.traverse(child=>{if(child.geometry)geometries.add(child.geometry);if(child.material&&!Array.isArray(child.material))materials.add(child.material);});
  for(const geometry of geometries)geometry.dispose();
  for(const m of materials)if(!sharedMaterials.has(m)){m.map?.dispose();m.dispose();}
  group.clear();overlays.clear();
 }
 function build(floor,ids,opts={}){
  const levels=opts.floors||[floor],empty=new Set();
  const layout=JSON.stringify(levels.map(level=>[level.id,level.elevation]));
  const fit=floorLayout!==layout;
  floorLayout=layout;currentFloor=floor;dark=!!opts.dark;section=!!opts.section;
  clearLayers();
  ground.position.y=Math.min(...levels.map(level=>level.elevation-Math.max(.24,...level.slabs.map(slab=>slab.thickness+.04))));
  for(const level of levels){
   const layer=new THREE.Group(),active=level.id===floor.id;
   layer.position.y=level.elevation;group.add(layer);
   if(active)activeGroup=layer;
   buildLevel(layer,level,active?ids:empty,opts,active);
  }
  const selected=ids.size===1?findElement(floor,ids.values().next().value):null;
  rotationTarget=selected&&!selected.host&&elementVisible(selected.element,opts)&&opts.interactive!==false?selected.element:null;
  function guideLine(a,b,color){
   const geometry=new THREE.BufferGeometry().setFromPoints([toScene(a),toScene(b)]);
   const line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color,dashSize:.15,gapSize:.08,depthTest:false}));
   line.computeLineDistances();line.renderOrder=10;overlays.add(line);
  }
  if(opts.axes){
   const vertices=[];
   for(const {element,host} of axisElements(floor,opts)){
    for(const {center,direction,extent} of elementAxes(element,host)){
     vertices.push(toScene({x:center.x-direction.x*extent,y:center.y-direction.y*extent}),
      toScene({x:center.x+direction.x*extent,y:center.y+direction.y*extent}));
    }
   }
   if(vertices.length){
    const axes=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(vertices),
     new THREE.LineDashedMaterial({color:0x2696ad,dashSize:.16,gapSize:.09,depthTest:false,transparent:true,opacity:.56}));
    axes.computeLineDistances();axes.renderOrder=9;overlays.add(axes);
   }
  }
  const guideBounds=new THREE.Box3().setFromObject(group);
  for(const guide of opts.feedback?.guides||[]){let a=guide.a,b=guide.b;if(guide.component==='x'){a={x:guide.a.x,y:guideBounds.min.z+3.5};b={x:guide.a.x,y:guideBounds.max.z+5.5};}if(guide.component==='y'){a={x:guideBounds.min.x+5,y:guide.a.y};b={x:guideBounds.max.x+7,y:guide.a.y};}guideLine(a,b,guide.axis?0x2696ad:0xbc43c5);}
  scene.background=new THREE.Color(dark?0x1b2028:0xf7f8fa);ground.material.color.set(dark?0x202833:0xf3f5f7);if(fit)fitCamera();dirty=true;
 }
 function fitCamera(){const bounds=new THREE.Box3().setFromObject(group);if(bounds.isEmpty()){target.set(-6,(currentFloor?.elevation??0)+1,-4.5);distance=24;}else{bounds.getCenter(target);const size=bounds.getSize(new THREE.Vector3());distance=Math.max(12,size.length()*1.5);}dirty=true;}
 function label(layer,text,x,y,z,id,selected){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle=dark?'#e6edf7':'#344257';if(selected)ctx.fillStyle='#2164ff';ctx.font='500 28px Segoe UI, Arial';ctx.textAlign='center';ctx.fillText(text,256,58);const texture=new THREE.CanvasTexture(canvas);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true}));sprite.position.set(x-6,y,z-4.5);sprite.scale.set(1.85,.35,1);sprite.userData.elementId=id;layer.add(sprite);}
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
 const observer=new ResizeObserver(resize);observer.observe(container);
 function toScene(point){return new THREE.Vector3(point.x-6,(currentFloor?.elevation??0)+.05,point.y-4.5);}
 function frameLoop(){
  raf=requestAnimationFrame(frameLoop);
  if(!container.clientWidth||!dirty)return;
  const fittedDistance=distance*Math.max(1,1.25/camera.aspect);
  camera.position.set(target.x+fittedDistance*Math.sin(polar)*Math.sin(angle),
   target.y+fittedDistance*Math.cos(polar),target.z+fittedDistance*Math.sin(polar)*Math.cos(angle));
  camera.lookAt(target);renderer.render(scene,camera);
  const handle=rotationTarget&&transformHandles(rotationTarget,null,.035).find(h=>h.key==='rotate');
  rotationButton.hidden=true;
  if(handle){
   const screen=toScene(handle).project(camera);
   if(Math.abs(screen.x)<.93&&Math.abs(screen.y)<.91&&Math.abs(screen.z)<1){
    rotationButton.style.left=(screen.x+1)*50+'%';rotationButton.style.top=(1-screen.y)*50+'%';
    rotationButton.hidden=false;
   }
  }
  dirty=false;
 }
 function setRay(event,offsetX=0){
  const r=renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX+offsetX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
  raycaster.setFromCamera(pointer,camera);
 }
 function pick(event){
  setRay(event);
  raycaster.params.Line.threshold=.08;
  if(!activeGroup)return;
  activeGroup.updateWorldMatrix(true,true);
  return raycaster.intersectObjects(activeGroup.children,true).find(hit=>hit.object.userData.elementId);
 }
 function groundPoint(event,offsetX=0){
  setRay(event,offsetX);
  const p=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-(currentFloor?.elevation??0)),new THREE.Vector3());
  return p?{x:p.x+6,y:p.z+4.5}:null;
 }
 function selectInView(rect){
  const view=container.getBoundingClientRect(),byId=new Map();
  if(!activeGroup)return [];
  activeGroup.updateWorldMatrix(true,true);
  activeGroup.traverse(object=>{
   const id=object.userData.elementId;
   if(!id)return;
   if(!byId.has(id))byId.set(id,new THREE.Box3());
   byId.get(id).expandByObject(object);
  });
  const ids=[];
  for(const [id,bounds] of byId){
   const xs=[],ys=[];
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const p=new THREE.Vector3(x,y,z).project(camera);
    if(p.z<-1||p.z>1)continue;
    xs.push(view.left+(p.x+1)*view.width/2);ys.push(view.top+(1-p.y)*view.height/2);
   }
   if(!xs.length)continue;
   const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
   const matches=rect.crossing?left<=rect.right&&right>=rect.left&&top<=rect.bottom&&bottom>=rect.top
    :left>=rect.left&&right<=rect.right&&top>=rect.top&&bottom<=rect.bottom;
   if(matches)ids.push(id);
  }
  return ids;
 }
 function cancelSelection(){
  if(drag?.mode!=='select')return false;
  drag=null;marquee.hidden=true;return true;
 }
 const clientPoint=event=>({x:event.clientX,y:event.clientY});
 container.addEventListener('contextmenu',event=>event.preventDefault());
 container.addEventListener('pointerdown',event=>{
  if(drag||!event.isPrimary||![0,1,2].includes(event.button))return;
  const rotate=event.target===rotationButton||rotationButton.contains(event.target);
  if(!rotate&&event.target!==renderer.domElement)return;
  const start=clientPoint(event);
  if(event.button!==0)drag={mode:'orbit',start,angle,polar};
  else if(rotate&&rotationTarget){
   const point=groundPoint(event);
   if(!point)return;
   drag={mode:'transform',start};
   gestures.start?.(rotationTarget.id,point,'rotate');
  }else{
   const id=pick(event)?.object.userData.elementId,point=groundPoint(event);
   if(id&&point&&!event.shiftKey){
    drag={mode:'transform',start};
    gestures.start?.(id,point);
   }else drag={mode:'select',start,id,extend:event.shiftKey};
  }
  event.preventDefault();container.setPointerCapture(event.pointerId);
 });
 container.addEventListener('pointermove',event=>{
  if(!drag)return;
  const point=clientPoint(event),dx=point.x-drag.start.x,dy=point.y-drag.start.y;
  drag.active ||= Math.hypot(dx,dy)>=4;
  if(!drag.active)return;
  if(drag.mode==='transform'){
   const world=groundPoint(event),adjacent=groundPoint(event,1);
   if(world&&adjacent)gestures.move?.(world,event.shiftKey,event.altKey,Math.hypot(world.x-adjacent.x,world.y-adjacent.y));
  }else if(drag.mode==='select'){
   showSelectionBox(marquee,selectionBounds(drag.start,point),container.getBoundingClientRect());
  }else{
   angle=drag.angle-dx*.007;polar=Math.max(.25,Math.min(1.47,drag.polar-dy*.005));dirty=true;
  }
 });
 container.addEventListener('pointerup',event=>{
  const gesture=drag;drag=null;marquee.hidden=true;
  if(gesture?.mode==='transform')gestures.end?.();
  if(gesture?.mode==='select'){
   if(gesture.active)gestures.selectMany?.(selectInView(selectionBounds(gesture.start,clientPoint(event))),gesture.extend);
   else if(gesture.id||!gesture.extend)onSelect(gesture.id,gesture.extend);
  }
 });
 function cancelDrag(){
  const gesture=drag;drag=null;marquee.hidden=true;
  if(gesture?.mode==='transform')gestures.cancel?.();
 }
 container.addEventListener('pointercancel',cancelDrag);
 container.addEventListener('lostpointercapture',cancelDrag);
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(2,Math.min(Math.max(300,distance),distance*Math.exp(e.deltaY*.001)));dirty=true;},{passive:false});
 frameLoop();return {update:build,resize,cancelSelection,reset(){angle=.76;polar=.79;fitCamera();},facade(){angle=Math.PI;polar=1.47;fitCamera();},dispose(){cancelAnimationFrame(raf);observer.disconnect();clearLayers();for(const texture of textures.values())texture.dispose();for(const material of sharedMaterials)material.dispose();renderer.dispose();}};
}
