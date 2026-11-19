import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeStructure} from '../structures.js';
import {createEmptyProject} from '../model.js';
import {viewSnapTargets,viewSnapSet,snapViewTranslation} from '../view-snapping.js';
import {projectView,unprojectView,renderOrthographic,exportOrthographic} from '../views.js';
import {cubeMarkup} from '../view-cube.js';
import {capHoles} from '../hardware.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function fixture(){
 const floor=createEmptyProject().floors[0],a=makeStructure('beam','moving',[{x:0,y:0},{x:2,y:0}]),b=makeStructure('beam','target',[{x:4,y:3},{x:6,y:3}]);
 a.height=b.height=.2;a.thickness=b.thickness=.1;a.elevation=.31;b.elevation=.5;floor.structures.push(a,b);return {floor,a,b};
}
test('each projected view round-trips world points without changing its hidden coordinate',()=>{
 const p={x:2,y:3,z:4};
 for(const view of ['top','bottom','front','back','left','right']){
  const depth=['top','bottom'].includes(view)?p.z:['front','back'].includes(view)?p.y:p.x;
  assert.deepEqual(unprojectView(projectView(p,view),view,depth),p);
 }
});
test('corners and centers snap in all six view planes with the correct mirrored directions',()=>{
 const {floor}=fixture();
 for(const [view,x,y,expectedX,expectedY] of [['top',3.982,2.982,4,3],['bottom',3.982,-2.982,4,-3],['front',3.982,-.187,4,-.19],['back',-3.982,-.187,-4,-.19],['left',2.982,-.187,3,-.19],['right',-2.982,-.187,-3,-.19]]){
  const result=snapViewTranslation(floor,['moving'],view,x,y,.03,{axes:false,alignment:true});
  near(result.dx,expectedX);near(result.dy,expectedY);assert.ok(result.marker);assert.ok(result.guides.length>=2);
 }
});
test('vertical-only dragging aligns heights across the view and obeys snap and grid switches',()=>{
 const {floor}=fixture();
 const result=snapViewTranslation(floor,['moving'],'front',.4,-.187,.01,{onlyAxis:'y',alignment:true});near(result.dx,0);near(result.dy,-.19);assert.equal(result.guides[0].component,'y');
 const disabled=snapViewTranslation(floor,['moving'],'front',0,-.187,.01,{onlyAxis:'y',snap:false});near(disabled.dy,-.187);assert.equal(disabled.label,'');
 const grid=snapViewTranslation(floor,['moving'],'front',.13,-.12,.01,{snap:false,gridSnap:true,gridStep:.25});near(grid.dx,.25);near(grid.dy,-.19);
});
test('projected hole anchors retain real floor elevations and axes respect type visibility',()=>{
 const {floor}=fixture();floor.elevation=3;
 const cap=makeStructure('pileCap','cap',[{x:8,y:2}]);cap.rotation=30;floor.structures.push(cap);
 const targets=viewSnapTargets(floor,'front',[],{axes:true});
 const hole=capHoles(cap)[0],projected=targets.points.find(p=>p.id==='cap'&&p.role==='Центр отверстия 1'&&Math.abs(p.y+3)<1e-8);
 assert.ok(projected);near(projected.x,hole.x);
 assert.ok(targets.lines.some(l=>l.id==='cap'));
 assert.equal(viewSnapTargets(floor,'front',[],{axes:true,axisTypes:{foundation:false}}).lines.filter(l=>l.id==='cap').length,0);
});
test('moving a supported assembly excludes its dependent boards from stationary snap targets',()=>{
 const {floor}=fixture(),a=makeStructure('pileCap','cap-a',[{x:10,y:0}]),b=makeStructure('pileCap','cap-b',[{x:12,y:0}]),board=makeStructure('rimBoard','board',[{x:10,y:0},{x:12,y:0}]);
 board.mounts=[{end:'a',capId:a.id,holeIndex:0},{end:'b',capId:b.id,holeIndex:0}];floor.structures.push(a,b,board);
 const set=viewSnapSet(floor,[a.id,b.id],'front');assert.ok(set.anchors.some(p=>p.id==='board'));assert.ok(!set.targets.points.some(p=>p.id==='board'));
});
test('alignment guides and markers render in side views and stay out of exported drawings',()=>{
 const {floor}=fixture(),feedback={plane:{view:'front',depth:0},guides:[{a:{x:4,y:-.5},b:{x:1,y:-.5},component:'y'}],marker:{x:4,y:-.5},label:'Угол'};
 floor.construction.push({id:'guide',kind:'guide',type:'line',style:'dashed',name:'Линия',a:{x:0,y:0},b:{x:4,y:0},divisions:4});
 const html=renderOrthographic([floor],'front',{feedback,bounds:{x:0,y:-2,w:8,h:4},axes:true});assert.match(html,/alignment-guide/);assert.match(html,/projected-snap-marker/);assert.match(html,/M0 -0.5L8 -0.5/);
 assert.match(html,/projection-guide/);assert.equal(viewSnapTargets(floor,'front').segments.find(s=>s.id==='guide').b.x,4);
 assert.doesNotMatch(exportOrthographic([floor],'front',{feedback,axes:true}),/alignment-guide|projected-snap-marker|symmetry-axis/);
});
test('the cube projects finite faces at cardinal and orbit orientations and exposes opposite views',()=>{
 for(const view of ['top','bottom','front','back','left','right','orbit'])assert.doesNotMatch(cubeMarkup(view),/NaN|Infinity/);
 assert.match(cubeMarkup('top'),/data-cube-view="bottom"/);assert.notEqual(cubeMarkup('orbit',{angle:.2,polar:.8}),cubeMarkup('orbit',{angle:1.2,polar:.8}));
});
