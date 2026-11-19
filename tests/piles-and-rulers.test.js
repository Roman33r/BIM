import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyProject,validateProject} from '../model.js';
import {makeStructure,screwBladeMesh,linkedPileSelection} from '../structures.js';
import {moveSelectionToFloor,translateSelection} from '../elements.js';
import {elementAngle,elementFrame,resizeElement,setElementAngle,transformHandles} from '../transforms.js';
import {rulerTicks,segmentMeasurement} from '../measurements.js';
import {exportSVG,renderPlan} from '../plan.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
const center={x:3,y:2};
function pileFixture(){
 const project=createEmptyProject(),floor=project.floors[0];
 const pile=makeStructure('screwPile','screw',[center]);
 floor.structures.push(pile);
 return {project,floor,pile};
}

test('an editable screw pile uses independent shaft and helical blade dimensions',()=>{
 const {project,floor,pile}=pileFixture();
 assert.deepEqual(transformHandles(pile).map(h=>h.key),['diameter','bladeDiameter']);
 resizeElement(floor,pile.id,'diameter',{x:3.08,y:2});
 resizeElement(floor,pile.id,'bladeDiameter',{x:2.78,y:2});
 near(pile.diameter,.16);near(pile.bladeDiameter,.44);
 const {vertices,indices}=screwBladeMesh(pile),outer=vertices.slice(3,6),end=vertices.slice(-9,-6);
 near(Math.hypot(outer[0],outer[2]),.22);near(end[1]-outer[1],pile.bladePitch);
 assert.ok(vertices.every(Number.isFinite)&&indices.every(i=>i>=0&&i<vertices.length/3));
 assert.equal((renderPlan(floor).content.match(/data-structure-type="screwPile".*?<\/g>/)||[]).length,1);
 validateProject(project);
 pile.bladeDiameter=.12;
 assert.throws(()=>validateProject(project));
});

test('a linked cap retains one association and follows translation, resizing and floor transfer',()=>{
 const {project,floor,pile}=pileFixture();
 const cap=makeStructure('pileCap','cap',[center]);
 cap.pileId=pile.id;
 floor.structures.push(cap);
 validateProject(project);
 near(cap.elevation,pile.elevation+cap.height);
 translateSelection(floor,[cap.id,pile.id],1,2);
 assert.deepEqual([pile.x,pile.y,cap.x,cap.y],[4,4,4,4]);
 translateSelection(floor,[cap.id],2,1);
 assert.deepEqual([pile.x,pile.y,cap.x,cap.y],[6,5,6,5]);
 setElementAngle(floor,cap.id,37.5);
 near(elementAngle(cap),37.5);
 near(elementFrame(cap).center.x,6);near(elementFrame(cap).center.y,5);
 pile.elevation=-.35;cap.height=.05;
 validateProject(project);
 near(cap.elevation,-.30);
 assert.deepEqual([...linkedPileSelection(floor,[cap.id],false)],[cap.id]);
 assert.deepEqual([...linkedPileSelection(floor,[pile.id],false)],[pile.id,cap.id]);
 const target=createEmptyProject().floors[0];target.elevation=3;project.floors.push(target);
 assert.deepEqual(moveSelectionToFloor(floor,target,[cap.id]),[pile.id,cap.id]);
 assert.deepEqual(floor.structures,[]);
 validateProject(project);
 target.structures.pop();floor.structures.push(cap);
 assert.throws(()=>validateProject(project));
});

test('absolute rotation preserves the element center and its dimensions',()=>{
 const floor=createEmptyProject().floors[0];
 const beam=makeStructure('beam','b',[{x:0,y:0},{x:4,y:0}]);floor.structures.push(beam);
 setElementAngle(floor,beam.id,135.5);
 const result=elementFrame(beam);
 near(elementAngle(beam),135.5);near(result.w,4);near(result.center.x,2);near(result.center.y,0);
 setElementAngle(floor,beam.id,270);
 near(elementAngle(beam),-90);near(elementFrame(beam).w,4);
});

test('ruler tick density follows zoom and rapid measurements stay outside SVG exports',()=>{
 const distant=rulerTicks(-4,5,41).filter(t=>t.major).map(t=>t.value);
 const nearTicks=rulerTicks(-4,5,150).filter(t=>t.major).map(t=>t.value);
 assert.ok(distant.includes(0)&&distant.includes(-2));
 assert.ok(nearTicks.length>distant.length);
 assert.deepEqual(rulerTicks(0,1,0),[]);
 const measurement={a:{x:1,y:2},b:{x:4,y:6}};
 const {dx,dy,distance,angle}=segmentMeasurement(measurement.a,measurement.b);
 assert.deepEqual([dx,dy,distance],[3,4,5]);near(angle,53.13010235415598);
 const floor=createEmptyProject().floors[0];
 assert.match(renderPlan(floor,{measurement}).content,/ruler-measurement/);
 assert.doesNotMatch(exportSVG(floor,{measurement}),/ruler-measurement/);
});
