import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {FASTENER_TYPES,capGeometry,capHoles,capLocalHoles,capHoleSettings,fastenerObject,fastenerRange} from '../hardware.js';
import {makeStructure} from '../structures.js';
import {createEmptyProject,validateProject} from '../model.js';
import {elementAnchors,elementFrame,resizeElement,setElementAngle} from '../transforms.js';
import {translateSelection} from '../elements.js';
import {setElementTilt,projectedElement,elementTilts,applyElementTilts} from '../spatial.js';
import {renderPlan,exportSVG} from '../plan.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});

test('pile cap holes are actual through cuts in the mesh and rotated snap targets in the plan',()=>{
 const project=createEmptyProject(),floor=project.floors[0],cap=makeStructure('pileCap','cap',[{x:2,y:3}]);
 floor.structures.push(cap);
 assert.equal(capHoles(cap).length,4);
 const geometry=capGeometry(THREE,cap),mesh=new THREE.Mesh(geometry,material);
 for(const p of capLocalHoles(cap)){
  const ray=new THREE.Raycaster(new THREE.Vector3(p.x,p.y,1),new THREE.Vector3(0,0,-1));
  assert.equal(ray.intersectObject(mesh).length,0);
 }
 assert.ok(new THREE.Raycaster(new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length>0);
 cap.rotation=30;
 assert.equal(elementAnchors(cap).filter(p=>p.role.startsWith('Центр отверстия')).length,4);
 const p=capHoles(cap)[0],local=capLocalHoles(cap)[0];
 near(p.x,cap.x+local.x*Math.cos(Math.PI/6)-local.y*Math.sin(Math.PI/6));
 validateProject(project);
 assert.match(exportSVG(floor),/class="perforated-pile-cap" data-hole-count="4"/);
 assert.match(renderPlan(floor).content,/fill-rule="evenodd"/);
 geometry.dispose();
});

test('cap hole patterns persist and invalid edge clearances or overlaps are rejected',()=>{
 for(const count of [0,2,4,8]){
  const project=createEmptyProject(),cap=makeStructure('pileCap','cap',[{x:0,y:0}]);
  cap.holeCount=count;project.floors[0].structures.push(cap);
  assert.equal(capHoles(cap).length,count);
  const saved=validateProject(JSON.parse(JSON.stringify(project))).floors[0].structures[0];
  assert.equal(saved.holeCount,count);
 }
 const project=createEmptyProject(),cap=makeStructure('pileCap','bad',[{x:0,y:0}]);project.floors[0].structures.push(cap);
 cap.holeInset=.001;assert.throws(()=>validateProject(project),/за край/);
 cap.holeInset=.12;assert.throws(()=>validateProject(project),/за край|пересекаются/);
 cap.holeInset=.04;cap.holeCount=3;assert.throws(()=>validateProject(project),/количество/);
 delete cap.holeInset;delete cap.holeDiameter;delete cap.holeCount;cap.w=cap.d=.05;
 validateProject(project);assert.equal(capHoles(cap).length,4);assert.ok(capHoleSettings(cap).diameter<=.01);
});

test('all fastener types render, preserve millimeter sizes and support rotation, tilt and group movement',()=>{
 const project=createEmptyProject(),floor=project.floors[0];
 for(const type of Object.keys(FASTENER_TYPES))floor.structures.push(makeStructure(type,type,[{x:1,y:2}]));
 const ids=new Set(floor.structures.map(e=>e.id));translateSelection(floor,ids,2,3);
 for(const e of floor.structures){
  near(elementFrame(e).center.x,3);near(elementFrame(e).center.y,5);
  setElementAngle(floor,e.id,45);near(e.x,3);near(e.y,5);
  resizeElement(floor,e.id,'headDiameter',{x:3.02,y:5});near(e.headDiameter,.04);
  setElementTilt(e,'tiltX',35);assert.ok(projectedElement(e).length>=3);
  const mount={x:e.x,y:e.y,z:e.elevation};
  const tiltedMount=applyElementTilts(mount,elementTilts(e));
  for(const axis of ['x','y','z'])near(tiltedMount[axis],mount[axis]);
 }
 validateProject(project);
 const saved=validateProject(JSON.parse(JSON.stringify(project)));
 assert.deepEqual(saved.floors[0].structures,floor.structures);
 const svg=renderPlan(floor).content;
 for(const type of Object.keys(FASTENER_TYPES))assert.ok(svg.includes(`data-structure-type="${type}"`));
 near(makeStructure('washer','washer-test',[{x:0,y:0}]).height,.0025);
});

test('nuts and washers have open center bores; fastener geometry stays within its vertical range',()=>{
 for(const type of Object.keys(FASTENER_TYPES)){
  const e=makeStructure(type,type,[{x:0,y:0}]),node=fastenerObject(THREE,e,material);
  node.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(node),[bottom,top]=fastenerRange(e);
  near(box.min.y,bottom);near(box.max.y,top);
  if(type==='nut'||type==='washer'){
   const ray=new THREE.Raycaster(new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0));
   assert.equal(ray.intersectObject(node,true).length,0);
   assert.ok(new THREE.Raycaster(new THREE.Vector3(e.headDiameter*.4,1,0),new THREE.Vector3(0,-1,0)).intersectObject(node,true).length>0);
  }
  node.traverse(child=>child.geometry?.dispose());
 }
});
