import {test} from 'node:test';
import assert from 'node:assert/strict';
import {linearDimensionOffset} from '../annotations.js';
import {createEmptyProject,validateProject} from '../model.js';
import {renderPlan,exportSVG} from '../plan.js';

test('the third dimension point sets a signed perpendicular offset for any segment direction',()=>{
 assert.equal(linearDimensionOffset({x:0,y:0},{x:4,y:0},{x:99,y:-2}),-2);
 assert.equal(linearDimensionOffset({x:0,y:0},{x:0,y:4},{x:-3,y:99}),3);
 assert.equal(linearDimensionOffset({x:1,y:2},{x:4,y:6},{x:10,y:9}),-3);
 assert.equal(linearDimensionOffset({x:1,y:2},{x:1,y:2},{x:10,y:9}),0);
});

test('dimension placement previews either side while the measured points stay fixed',()=>{
 const project=createEmptyProject(),floor=project.floors[0];
 const a={x:0,y:0},b={x:4,y:0};
 for(const offset of [-1,2]){
  const html=renderPlan(floor,{dimensions:false,dimensionDraft:{a,b,offset}}).content;
  assert.match(html,/class="dimension-preview"/);
  assert.ok(html.includes(`M0 ${offset}L4 ${offset}`));
  assert.match(html,/4 000/);
  assert.equal(floor.dimensions.length,0);
 }
 floor.dimensions.push({id:'dimension-test',kind:'dimension',name:'Размер',a,b,offset:-1});
 const saved=validateProject(JSON.parse(JSON.stringify(project))).floors[0].dimensions[0];
 assert.deepEqual(saved.a,a);assert.deepEqual(saved.b,b);assert.equal(saved.offset,-1);
 assert.ok(exportSVG(floor,{dimensions:true}).includes('M0 -1L4 -1'));
 assert.doesNotMatch(exportSVG(floor,{dimensions:true}),/dimension-preview/);
});
