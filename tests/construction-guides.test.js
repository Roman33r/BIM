import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyProject,validateProject} from '../model.js';
import {snapTargets,snapPoint,snapTranslation} from '../snapping.js';
import {translateSelection} from '../elements.js';
import {resizeElement,setElementAngle,elementAnchors} from '../transforms.js';
import {renderPlan} from '../plan.js';
import {makeStructure} from '../structures.js';

test('guide division points and standalone points support precise snaps and alignment',()=>{
 const project=createEmptyProject(),floor=project.floors[0];
 floor.construction.push({id:'line',kind:'guide',type:'line',name:'Линия',style:'center',a:{x:0,y:0},b:{x:4,y:0},divisions:4},
  {id:'point',kind:'guide',type:'point',name:'Точка',x:7,y:2});
 const targets=snapTargets(floor,null,false);
 assert.equal(snapPoint({x:1.02,y:.01},targets,.05).label,'Точка деления');
 const line=snapPoint({x:1.3,y:.02},targets,.05,{axes:false});
 assert.equal(line.label,'Вспомогательная линия');
 assert.equal(line.point.y,0);
 assert.equal(snapPoint({x:7.01,y:2.01},targets,.05).label,'Опорная точка');
 const beam=makeStructure('beam','beam',[{x:6,y:3},{x:8,y:3}]);
 floor.structures.push(beam);
 const move=snapTranslation(floor,'beam',.01,-.99,.05,{axes:false});
 assert.ok(Math.abs(move.dy+1)<1e-8);
 validateProject(project);
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project))).floors[0].construction,floor.construction);
});

test('guide anchors follow resizing, rotation and group movement while old projects migrate',()=>{
 const project=createEmptyProject(),floor=project.floors[0];
 const guide={id:'line',kind:'guide',type:'line',name:'Линия',style:'dashed',a:{x:0,y:0},b:{x:4,y:0},divisions:4};
 floor.construction.push(guide);
 resizeElement(floor,'line','b',{x:8,y:0});
 assert.equal(elementAnchors(guide)[1].x,2);
 setElementAngle(floor,'line',90);
 translateSelection(floor,['line'],1,2);
 assert.ok(Math.abs(elementAnchors(guide)[1].x-5)<1e-8);
 assert.match(renderPlan(floor).content,/data-guide-type="line"/);
 validateProject(project);
 guide.divisions=1.5;
 assert.throws(()=>validateProject(project));
 delete floor.construction;
 assert.deepEqual(validateProject(project).floors[0].construction,[]);
});
