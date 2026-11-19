import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Euler,Vector3} from '../vendor/three.module.js';
import {createEmptyProject,validateProject} from '../model.js';
import {makeStructure} from '../structures.js';
import {elementAngle,setElementAngle} from '../transforms.js';
import {applyElementTilts,elementTilts,projectedElement,setElementTilt} from '../spatial.js';
import {exportSVG,planBounds,renderPlan} from '../plan.js';
import {selectionBounds,selectInPlan} from '../selection.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} ≠ ${expected}`);

test('both inclination axes agree with the Three.js orientation and retain plan rotation',()=>{
 const project=createEmptyProject(),floor=project.floors[0];
 const beam=makeStructure('beam','beam',[{x:0,y:0},{x:4,y:0}]);
 floor.structures.push(beam);
 setElementAngle(floor,beam.id,20);
 setElementTilt(beam,'tiltX',35);
 setElementTilt(beam,'tiltY',-24.5);
 near(elementAngle(beam),20);
 const tilt=elementTilts(beam)[0],{pivot}=tilt,point={x:3,y:1,z:2};
 const actual=applyElementTilts(point,[tilt]);
 const three=new Vector3(point.x-pivot.x,point.z-pivot.z,point.y-pivot.y)
  .applyEuler(new Euler(-tilt.x,0,-tilt.y,'ZXY'));
 near(actual.x,pivot.x+three.x);near(actual.y,pivot.y+three.z);near(actual.z,pivot.z+three.y);
 assert.deepEqual(applyElementTilts(pivot,[tilt]),pivot);
 const stored=validateProject(JSON.parse(JSON.stringify(project))).floors[0].structures[0];
 assert.deepEqual(stored,beam);
 setElementTilt(beam,'tiltX',360);
 assert.equal(beam.tiltX,undefined);
 assert.equal(beam.tiltY,-24.5);
});

test('inclined wall projection fits, selects and exports with its hosted opening unchanged',()=>{
 const project=createEmptyProject(),floor=project.floors[0];
 const wall={id:'wall',kind:'wall',name:'Стена',a:{x:0,y:0},b:{x:4,y:0},height:3,thickness:.3,material:'Кирпич',
  openings:[{id:'door',kind:'door',name:'Дверь',position:2,width:1,height:2.1,sill:0}]};
 floor.walls.push(wall);
 const opening=structuredClone(wall.openings[0]);
 setElementTilt(wall,'tiltX',90);
 validateProject(project);
 assert.deepEqual(wall.openings[0],opening);
 const outline=projectedElement(wall);
 near(Math.min(...outline.map(p=>p.y)),-1.5);
 near(Math.max(...outline.map(p=>p.y)),1.5);
 assert.ok(planBounds(floor).h>=5.4);
 assert.deepEqual(selectInPlan(floor,selectionBounds({x:1.65,y:1.3},{x:1.35,y:1.1})),['wall']);
 assert.match(renderPlan(floor,{interactive:true}).content,/class="tilt-projection movable-element" data-element="wall"/);
 assert.match(exportSVG(floor),/tilt-projection/);
 wall.openings[0].tiltY=12;
 assert.throws(()=>validateProject(project));
});

test('a cap inherits the pile tilt without moving its mounting point',()=>{
 const project=createEmptyProject(),floor=project.floors[0],origin={x:3,y:7};
 const pile=makeStructure('screwPile','pile',[origin]),cap=makeStructure('pileCap','cap',[origin]);
 cap.pileId=pile.id;floor.structures.push(pile,cap);
 setElementTilt(pile,'tiltY',45);
 setElementTilt(cap,'tiltX',30);
 validateProject(project);
 const anchor={...origin,z:pile.elevation};
 const rotations=elementTilts(cap,pile);
 assert.equal(rotations.length,2);
 assert.deepEqual(applyElementTilts(anchor,rotations),anchor);
 const uprightCap=projectedElement(cap),mountedCap=projectedElement(cap,pile);
 assert.notDeepEqual(uprightCap,mountedCap);
 assert.match(renderPlan(floor).content,/class="tilt-projection movable-element" data-element="cap"/);
});
