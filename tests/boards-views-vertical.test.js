import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeStructure} from '../structures.js';
import {createEmptyProject,validateProject} from '../model.js';
import {boardGeometry,boardMountPoints,boardFasteners} from '../board-mounts.js';
import {capHoles} from '../hardware.js';
import {translateSelection,makeFurniture} from '../elements.js';
import {translateVertical,verticalRange} from '../vertical.js';
import {projectView,viewDelta,cameraStep,projectedElements,renderOrthographic,selectOrthographic,exportOrthographic} from '../views.js';
import {renderPlan} from '../plan.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function fixture(){
 const project=createEmptyProject(),floor=project.floors[0];
 const a=makeStructure('pileCap','cap-a',[{x:0,y:0}]),b=makeStructure('pileCap','cap-b',[{x:3,y:0}]);
 const board=makeStructure('rimBoard','board',[capHoles(a)[0],capHoles(b)[0]]);
 board.mounts=[{end:'a',capId:a.id,holeIndex:0},{end:'b',capId:b.id,holeIndex:0}];floor.structures.push(a,b,board);validateProject(project);
 return {project,floor,a,b,board};
}
test('separate rim boards persist their hole bindings, overhang and mounting height',()=>{
 const {project,floor,a,b,board}=fixture();
 near(board.elevation,a.elevation+board.height);near(Math.hypot(board.b.x-board.a.x,board.b.y-board.a.y),3.1);
 const before=JSON.stringify(project);validateProject(project);assert.equal(JSON.stringify(project),before);
 translateSelection(floor,new Set([a.id,b.id,board.id]),2,1);validateProject(project);
 assert.equal(board.mounts.length,2);near(board.a.x,capHoles(a)[0].x-.05);
 const saved=validateProject(JSON.parse(JSON.stringify(project)));assert.deepEqual(saved.floors[0].structures,floor.structures);
 assert.match(renderPlan(floor).content,/mounted-rim-board/);
});
test('board attachment holes cut through the wood and fasteners reach through both the board and cap',()=>{
 const {floor,board}=fixture(),geometry=boardGeometry(THREE,board,floor.structures),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 const length=Math.hypot(board.b.x-board.a.x,board.b.y-board.a.y),ux=(board.b.x-board.a.x)/length,uy=(board.b.y-board.a.y)/length;
 for(const {point} of boardMountPoints(board,floor.structures)){
  const dx=point.x-board.a.x,dy=point.y-board.a.y;
  assert.equal(new THREE.Raycaster(new THREE.Vector3(dx*ux+dy*uy,-dx*uy+dy*ux,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length,0);
 }
 assert.ok(new THREE.Raycaster(new THREE.Vector3(length/2,0,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length>0);
 let id=0;for(const bolt of boardFasteners(board,floor.structures,'bolt',()=>String(++id))){near(bolt.elevation,board.elevation);assert.ok(bolt.height>=board.height+.02+.015);}
 geometry.dispose();mesh.material.dispose();
});
test('bound boards follow a lifted assembly and detach when moved independently',()=>{
 const {project,floor,a,b,board}=fixture();
 const initial=board.elevation;
 translateVertical(floor,new Set([a.id,b.id,board.id]),.5);validateProject(project);near(board.elevation,initial+.5);assert.equal(board.mounts.length,2);
 translateVertical(floor,new Set([board.id]),.2);validateProject(project);near(board.elevation,initial+.7);assert.equal(board.mounts,undefined);
});
test('vertical movement applies to walls, furniture and slab elevations and survives saving',()=>{
 const project=createEmptyProject(),floor=project.floors[0];
 const wall={id:'wall',kind:'wall',name:'Стена',a:{x:0,y:0},b:{x:4,y:0},thickness:.2,height:3,material:'Кирпич',openings:[]};
 const furniture=makeFurniture('desk',1,1,'desk'),slab={id:'slab',kind:'slab',name:'Плита',material:'Бетон',points:[{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}],thickness:.2};
 floor.walls.push(wall);floor.furniture.push(furniture);floor.slabs.push(slab);
 translateVertical(floor,new Set(['wall','desk','slab']),1.25);validateProject(project);
 assert.deepEqual(verticalRange(wall),[1.25,4.25]);assert.deepEqual(verticalRange(slab),[1.05,1.25]);near(verticalRange(furniture)[0],1.25);
 assert.equal(validateProject(JSON.parse(JSON.stringify(project))).floors[0].walls[0].baseElevation,1.25);
 const projected=projectedElements(floor,'front').find(e=>e.element.id==='wall').parts.flat();near(Math.min(...projected.map(p=>p.y)),-4.25);
});
test('orthographic views project true heights, mirror the bottom and map drags into world axes',()=>{
 const p={x:2,y:3,z:4};assert.deepEqual(projectView(p,'top'),{x:2,y:3});assert.deepEqual(projectView(p,'bottom'),{x:2,y:-3});assert.deepEqual(projectView(p,'front'),{x:2,y:-4});assert.deepEqual(projectView(p,'left'),{x:3,y:-4});
 assert.deepEqual(viewDelta(1,-2,'front'),{x:1,y:0,z:2});assert.deepEqual(viewDelta(1,-2,'right'),{x:0,y:-1,z:2});
 const {floor}=fixture();const html=renderOrthographic([floor],'front');assert.match(html,/data-element="board"/);
 assert.match(renderOrthographic([floor],'bottom'),/fill-rule="evenodd"/);
 assert.match(exportOrthographic([floor],'front'),/<title>Спереди<\/title>/);
 assert.ok(selectOrthographic(floor,'front',{left:-1,right:4,top:-1,bottom:1,crossing:false}).includes('board'));
});
test('camera navigation respects WASD, opposing keys, diagonal speed and bounded frame intervals',()=>{
 const forward=cameraStep(new Set(['KeyW']),0,.02,10);near(forward.x,0);near(forward.z,-.2);
 const diagonal=cameraStep(new Set(['KeyW','KeyD']),0,.02,10);near(Math.hypot(diagonal.x,diagonal.z),.2);
 for(const value of Object.values(cameraStep(new Set(['KeyW','KeyS']),0,1,10)))near(value,0);
 near(cameraStep(new Set(['KeyE']),0,50,10).y,.5);for(const value of Object.values(cameraStep(new Set(),1,.02,10)))near(value,0);
});
