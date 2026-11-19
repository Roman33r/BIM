import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createEmptyProject,validateProject} from '../model.js';
import {makeStructure,rimBoardSegments} from '../structures.js';
import {capHoles} from '../hardware.js';
import {autoPlaceOnSurface,seatOnSurface,partCapContacts,createPartFixings,componentHoles,componentGeometries,footprintsOverlap,distributeDrilling} from '../assembly.js';
import {verticalRange,translateVertical} from '../vertical.js';
import {translateSelection,moveSelectionToFloor} from '../elements.js';
import {holeVolumes,renderHoleXray} from '../hole-display.js';
import {renderPlan} from '../plan.js';
import {renderOrthographic} from '../views.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function assembly(){const project=createEmptyProject(),floor=project.floors[0],cap=makeStructure('pileCap','cap',[{x:0,y:0}]),part=makeStructure('rim','rim',[{x:-1,y:0},{x:1,y:0}]);cap.elevation=.02;cap.holeInset=.06;floor.structures.push(cap,part);return {project,floor,cap,part};}
let sequence=0;const id=prefix=>`${prefix}-${++sequence}`;

test('surface placement raises a beam onto the cap and respects an explicitly higher elevation',()=>{
 const {floor,cap,part}=assembly();near(autoPlaceOnSurface(floor,part),.02);near(verticalRange(part)[0],cap.elevation);
 near(autoPlaceOnSurface(floor,part),0);part.elevation=1;near(autoPlaceOnSurface(floor,part),0);near(part.elevation,1);
 seatOnSurface(floor,part);near(verticalRange(part)[0],cap.elevation);
 const square=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
 assert.equal(footprintsOverlap(square,square),true);assert.equal(footprintsOverlap(square,square.map(p=>({...p,x:p.x+1}))),false);
});
test('contact requires both a flush face and a bore entirely within a real board',()=>{
 const {floor,part,cap}=assembly();assert.equal(partCapContacts(floor,part)[0].side,null);
 autoPlaceOnSurface(floor,part);assert.equal(partCapContacts(floor,part)[0].holes.length,4);
 cap.holeInset=.04;assert.equal(partCapContacts(floor,part).length,0);
 cap.holeInset=.06;part.tiltX=10;assert.equal(partCapContacts(floor,part).length,0);
});
test('bolted joints drill real through holes and put the nut and washers outside both members',()=>{
 const {project,floor,cap,part}=assembly();autoPlaceOnSurface(floor,part);
 const created=createPartFixings(floor,part,'bolt',id);assert.equal(created.length,16);validateProject(project);
 const bolt=created[0],holes=componentHoles(part,floor.structures);assert.equal(holes.length,4);near(holes[0].bottom,.02);near(holes[0].top,.22);
 const meshes=componentGeometries(THREE,part,floor.structures).map(({geometry,top})=>{geometry.rotateX(Math.PI/2);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.position.y=top;mesh.updateMatrixWorld();return mesh;});
 for(const h of holes){const ray=new THREE.Raycaster(new THREE.Vector3(h.x,1,h.y),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObjects(meshes).length,0);}
 assert.ok(new THREE.Raycaster(new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0)).intersectObjects(meshes).length>0);
 assert.ok(bolt.elevation>part.elevation);assert.ok(bolt.elevation-bolt.height<verticalRange(cap)[0]);
 assert.ok(created[3].elevation<verticalRange(cap)[0]);assert.match(renderPlan(floor).content,/drilled-component/);
 assert.doesNotThrow(()=>validateProject(JSON.parse(JSON.stringify(project))));
 assert.throws(()=>createPartFixings(floor,part,'bolt',id),/уже установлен/);
});
test('wood screws enter from below the cap and cut blind bores to the actual penetration',()=>{
 const {project,floor,part}=assembly();autoPlaceOnSurface(floor,part);const [screw]=createPartFixings(floor,part,'structuralScrew',id);validateProject(project);
 assert.equal(screw.tiltX,180);assert.ok(screw.elevation<0);const h=componentHoles(part)[0];near(h.bottom,.02);assert.ok(h.top<part.elevation);
 const meshes=componentGeometries(THREE,part,floor.structures).map(({geometry,top})=>{geometry.rotateX(Math.PI/2);const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.position.y=top;m.updateMatrixWorld();return m;});
 const rays=new THREE.Raycaster(new THREE.Vector3(h.x,1,h.y),new THREE.Vector3(0,-1,0)).intersectObjects(meshes);assert.ok(rays.length>0);near(rays[0].point.y,part.elevation);
});
test('fixings reject an oversized shaft and malformed persisted connection data',()=>{
 const {project,floor,part,cap}=assembly();autoPlaceOnSurface(floor,part);cap.holeDiameter=.006;
 assert.throws(()=>createPartFixings(floor,part,'bolt',id),/шире/);cap.holeDiameter=.014;
 createPartFixings(floor,part,'bolt',id);part.fixings[0].capHoleIndex=-1;assert.throws(()=>validateProject(project),/крепление/);
});
test('hidden hole overlays are optional in all six projections and retain real floor heights',()=>{
 const {floor,part,cap}=assembly();floor.elevation=3;autoPlaceOnSurface(floor,part);createPartFixings(floor,part,'bolt',id);
 assert.ok(holeVolumes(floor).some(h=>h.owner===cap.id&&Math.abs(h.axis[0].z-3)<1e-7));
 assert.doesNotMatch(renderPlan(floor).content,/hole-xray-overlay/);assert.match(renderPlan(floor,{holeXray:true}).content,/hole-xray-overlay/);
 for(const view of ['top','bottom','front','back','left','right']){assert.doesNotMatch(renderHoleXray([floor],view),/NaN|undefined/);if(view!=='top'){assert.match(renderOrthographic([floor],view,{holeXray:true}),/hole-xray-overlay/);assert.doesNotMatch(renderOrthographic([floor],view),/hole-xray-overlay/);}}
});
test('moving a complete joint preserves its links while moving a part independently leaves its bores',()=>{
 const {project,floor,part,cap}=assembly();autoPlaceOnSurface(floor,part);const created=createPartFixings(floor,part,'bolt',id),ids=[part.id,cap.id,...created.map(e=>e.id)];
 translateSelection(floor,ids,2,1);validateProject(project);assert.equal(part.fixings.length,4);near(capHoles(cap)[0].x,componentHoles(part)[0].x);
 translateVertical(floor,ids,1);validateProject(project);assert.equal(part.fixings.length,4);near(verticalRange(part)[0],cap.elevation);
 translateSelection(floor,[part.id],1,0);validateProject(project);assert.equal(part.fixings,undefined);assert.equal(part.drillHoles.length,4);
});
test('splitting a fixed rim preserves the bores and their hardware on each individual board',()=>{
 const {project,floor,part}=assembly();autoPlaceOnSurface(floor,part);createPartFixings(floor,part,'bolt',id);
 const boards=rimBoardSegments(part,floor.structures).map((b,i)=>({...makeStructure('rimBoard','board'+i,[b.a,b.b]),thickness:b.thickness,height:part.height,elevation:part.elevation}));
 distributeDrilling(part,boards,floor.structures);floor.structures=floor.structures.filter(e=>e!==part);floor.structures.push(...boards);validateProject(project);
 assert.equal(boards.flatMap(e=>e.drillHoles||[]).length,4);assert.equal(boards.flatMap(e=>e.fixings||[]).length,4);
});
test('moving a connected member to a different floor drops references to the original floor',()=>{
 const {project,floor,part}=assembly();autoPlaceOnSurface(floor,part);createPartFixings(floor,part,'bolt',id);
 const target=structuredClone(createEmptyProject().floors[0]);target.id='second-floor';target.elevation=3;project.floors.push(target);
 moveSelectionToFloor(floor,target,[part.id]);validateProject(project);assert.equal(target.structures[0].fixings,undefined);assert.equal(target.structures[0].drillHoles.length,4);
});
