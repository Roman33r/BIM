import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyProject,createDemo,validateProject} from '../model.js';
import {STRUCTURE_TYPES,makeStructure,memberProfile} from '../structures.js';
import {findElement,moveSelectionToFloor,translateSelection} from '../elements.js';
import {elementFrame,resizeElement,transformHandles} from '../transforms.js';
import {selectInPlan,selectionBounds} from '../selection.js';
import {renderPlan,planBounds} from '../plan.js';

const points=[{x:20,y:2},{x:24,y:2},{x:24,y:6},{x:20,y:6}];

test('all construction types render, round-trip and participate in plan fitting',()=>{
 const project=createEmptyProject(),floor=project.floors[0];
 for(const type of Object.keys(STRUCTURE_TYPES)){
  const element=makeStructure(type,'s-'+type,points);
  assert.equal(element.elevation,element.kind==='foundation'?0:element.height);
  floor.structures.push(element);
 }
 validateProject(project);
 const restored=validateProject(JSON.parse(JSON.stringify(project))).floors[0];
 assert.deepEqual(restored.structures,floor.structures);
 const plan=renderPlan(restored).content;
 for(const type of Object.keys(STRUCTURE_TYPES))assert.ok(plan.includes(`data-structure-type="${type}"`));
 const bounds=planBounds(restored);
 assert.ok(bounds.x>18&&bounds.x+bounds.w>24);
 delete project.floors[0].structures;
 assert.deepEqual(validateProject(project).floors[0].structures,[]);
});

test('channel and I-beam retain their overall dimensions and distinct webs',()=>{
 for(const type of ['channel','ibeam']){
  const e=makeStructure(type,type,points),[bottom,top,web]=memberProfile(e);
  assert.equal(bottom.width,e.thickness);
  assert.equal(top.top,e.height);
  assert.equal(web.width,e.gauge);
  assert.equal(web.offset,type==='channel'?-(e.thickness-e.gauge)/2:0);
  assert.equal(web.bottom,bottom.top);
  assert.equal(web.top,top.bottom);
 }
 const project=createEmptyProject(),floor=project.floors[0];
 const e=makeStructure('channel','channel',points);
 floor.structures.push(e);
 e.gauge=e.height;
 assert.throws(()=>validateProject(project));
});

test('piles and framing members resize and move as a selection',()=>{
 const project=createEmptyProject(),floor=project.floors[0];
 const pile=makeStructure('pile','pile',points),beam=makeStructure('joist','beam',points);
 floor.structures.push(pile,beam);
 assert.deepEqual(elementFrame(pile).center,points[0]);
 assert.deepEqual(transformHandles(pile).map(handle=>handle.key),['diameter']);
 resizeElement(floor,pile.id,'diameter',{x:pile.x+.5,y:pile.y});
 resizeElement(floor,beam.id,'thickness',{x:22,y:2.25});
 assert.equal(pile.diameter,1);
 assert.equal(beam.thickness,.5);
 assert.deepEqual(selectInPlan(floor,selectionBounds({x:19,y:1},{x:25,y:3})),['pile','beam']);
 translateSelection(floor,['pile','beam'],3,1);
 assert.deepEqual(elementFrame(pile).center,{x:23,y:3});
 assert.deepEqual(beam.b,{x:27,y:3});
 validateProject(project);
});

test('group transfer includes structures and moves openings only with a host wall',()=>{
 const project=createDemo(),[source,target]=project.floors;
 const wall=source.walls[0],opening=wall.openings[0],otherOpening=source.walls[1].openings[0];
 const beam=makeStructure('beam','beam',points);
 source.structures.push(beam);
 assert.deepEqual(moveSelectionToFloor(source,target,[wall.id,opening.id,otherOpening.id,beam.id]),[wall.id,opening.id,beam.id]);
 assert.equal(findElement(target,beam.id).element,beam);
 assert.equal(findElement(target,opening.id).host,wall);
 assert.ok(findElement(source,otherOpening.id));
 assert.equal(findElement(source,beam.id),null);
 validateProject(project);
});
