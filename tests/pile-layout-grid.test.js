import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pileAreaPoints,selectedPileDimensions} from '../pile-layout.js';
import {snapToGrid} from '../grid.js';
import {createEmptyProject} from '../model.js';
import {makeStructure} from '../structures.js';
import {renderPlan} from '../plan.js';

test('pile area bisects both axes until every interval is smaller than the requested spacing',()=>{
 const a={x:-1,y:2},b={x:5.4,y:6.1};
 const points=pileAreaPoints(a,b);
 assert.deepEqual(points,pileAreaPoints(b,a));
 for(const [min,max,axis] of [[a.x,b.x,'x'],[a.y,b.y,'y']]){
  const values=[...new Set(points.map(p=>p[axis]))].sort((a,b)=>a-b);
  assert.equal(values[0],min);assert.equal(values.at(-1),max);
  assert.ok(values.includes((min+max)/2));
  assert.ok(values.slice(1).every((value,i)=>value-values[i]<1.5));
  assert.ok(values.slice(1).every((value,i)=>Math.abs(value-values[i]-(max-min)/(values.length-1))<1e-8));
 }
 assert.equal(new Set(points.map(p=>p.x+','+p.y)).size,points.length);
 const regular=pileAreaPoints({x:0,y:0},{x:6,y:3});
 assert.equal(regular.length,45);
 assert.deepEqual(regular.slice(0,4),[{x:0,y:0},{x:6,y:0},{x:0,y:3},{x:6,y:3}]);
 const firstInside=regular.findIndex(p=>p.x>0&&p.x<6&&p.y>0&&p.y<3);
 assert.ok(regular.slice(firstInside).every(p=>p.x>0&&p.x<6&&p.y>0&&p.y<3));
 assert.throws(()=>pileAreaPoints({x:0,y:0},{x:100,y:100},.1));
});

test('a short pile interval keeps only its ends; an interval equal to the step gets a midpoint',()=>{
 assert.deepEqual(pileAreaPoints({x:0,y:0},{x:1.4,y:1}),[{x:0,y:0},{x:1.4,y:0},{x:0,y:1},{x:1.4,y:1}]);
 const exact=pileAreaPoints({x:0,y:0},{x:1.5,y:1});
 assert.deepEqual([...new Set(exact.map(p=>p.x))].sort((a,b)=>a-b),[0,.75,1.5]);
 assert.deepEqual(pileAreaPoints({x:2,y:3},{x:2,y:3}),[{x:2,y:3}]);
 assert.throws(()=>pileAreaPoints({x:0,y:0},{x:6,y:3},1.5,44),/больше 44/);
});

test('selected pile sizes measure shaft extents, center distances and slope independently of other structures',()=>{
 const floor=createEmptyProject().floors[0],a=makeStructure('pile','a',[{x:0,y:0}]),b=makeStructure('screwPile','b',[{x:3,y:4}]);
 floor.structures.push(a,b,makeStructure('beam','beam',[{x:0,y:0},{x:9,y:0}]));
 const dimensions=selectedPileDimensions(floor,new Set(['a','b','beam']));
 assert.equal(dimensions.links.length,1);assert.equal(dimensions.links[0].length,5);
 assert.ok(Math.abs(dimensions.links[0].angle-53.13010235415598)<1e-8);
 assert.ok(Math.abs(dimensions.overall.length-(5+(.3+.108)/2))<1e-8);
 assert.equal(selectedPileDimensions(floor,new Set(['a'])),null);
 const svg=renderPlan(floor,{selectedIds:new Set(['a','b']),interactive:true}).content;
 assert.match(svg,/pile-selection-dimensions/);assert.match(svg,/Общий/);assert.match(svg,/Центры/);
});

test('configured grid uses its own snap spacing and can be hidden separately',()=>{
 assert.deepEqual(snapToGrid({x:1.17,y:-.83},.5),{x:1,y:-1});
 const floor=createEmptyProject().floors[0];
 assert.match(renderPlan(floor,{gridStep:.5,unit:.01}).content,/id="grid-minor" width="0.5" height="0.5"/);
 assert.doesNotMatch(renderPlan(floor,{grid:false}).content,/fill="url\(#grid-major\)"/);
});
