import {test} from 'node:test';
import assert from 'node:assert/strict';
import {endpointAtLength} from '../measurements.js';
import {renderPlan} from '../plan.js';
import {createEmptyProject} from '../model.js';

test('typed lengths retain the cursor direction and use millimeter precision',()=>{
 const a={x:2,y:3},result=endpointAtLength(a,{x:-1,y:7},1.237);
 assert.ok(Math.abs(Math.hypot(result.x-a.x,result.y-a.y)-1.237)<1e-10);
 assert.ok(Math.abs((result.x-a.x)/(result.y-a.y)+.75)<1e-10);
 assert.deepEqual(endpointAtLength(a,a,2),{x:4,y:3});
});

test('draft length and pile rectangle dimensions display independently of permanent dimensions',()=>{
 const floor=createEmptyProject().floors[0];
 const html=renderPlan(floor,{dimensions:false,drawMeasurement:{a:{x:0,y:0},b:{x:3,y:4}},
  pileArea:{a:{x:1,y:1},b:{x:7,y:4},points:[]}}).content;
 assert.match(html,/5 000 мм/);
 assert.match(html,/6 000 × 3 000 мм/);
 assert.match(html,/pile-area-size/);
 assert.match(html,/id="grid-major"/);
});
