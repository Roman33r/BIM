import {test} from 'node:test';
import assert from 'node:assert/strict';
import {angleValue} from '../annotations.js';
import {translateElement} from '../elements.js';
import {createEmptyProject,validateProject} from '../model.js';
import {planBounds,renderPlan,exportSVG} from '../plan.js';
import {snapWallTranslation} from '../snapping.js';
import {resizeElement,rotateElement,rotatePoint} from '../transforms.js';
import {hiddenWallEnds} from '../wall-overlaps.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} ≠ ${expected}`);
const wall=(id,a,b,thickness)=>({kind:'wall',id,name:id,a:{x:a[0],y:a[1]},b:{x:b[0],y:b[1]},thickness,height:3,material:'Кирпич',openings:[]});

test('wall dragging aligns a side and end at once with perpendicular wall faces',()=>{
 const moving=wall('moving',[0,0],[4,0],.3);
 const fixed=wall('fixed',[4.2,.17],[4.2,4],.4);
 const result=snapWallTranslation(moving,[fixed],.04,.03,.08);
 near(result.dx,0);near(result.dy,.02);
 assert.deepEqual(result.guides.map(guide=>guide.component),['x','y']);
 const rotate=p=>rotatePoint(p,{x:0,y:0},32);
 for(const w of [moving,fixed]){w.a=rotate(w.a);w.b=rotate(w.b);}
 const drag=rotate({x:.04,y:.03}),expected=rotate({x:0,y:.02});
 const rotated=snapWallTranslation(moving,[fixed],drag.x,drag.y,.08);
 near(rotated.dx,expected.x);near(rotated.dy,expected.y);
 assert.equal(rotated.guides.filter(guide=>guide.face).length,2);
});

test('hidden wall ends are dashed without a selection and skip flush joints and openings',()=>{
 const end=wall('end',[0,0],[4.12,0],.3),cover=wall('cover',[4.2,-2],[4.2,2],.4);
 const project=createEmptyProject(),floor=project.floors[0];
 floor.walls.push(end,cover);
 assert.equal(hiddenWallEnds(floor.walls)[0].strokes.length,3);
 assert.match(renderPlan(floor).content,/class="hidden-wall-end" data-hidden-wall="end".*stroke-dasharray=/);
 cover.openings.push({id:'door',kind:'door',name:'Door',position:2,width:.9,height:2.1,sill:0});
 assert.equal(hiddenWallEnds(floor.walls).length,0);
 cover.openings=[];
 end.b.x=4;
 assert.equal(hiddenWallEnds(floor.walls).length,0);
});

test('angular dimensions round-trip and preserve the measured angle when moved or rotated',()=>{
 const project=createEmptyProject(),floor=project.floors[0];
 const d={id:'angle',kind:'dimension',mode:'angle',name:'Угловой размер',vertex:{x:1,y:1},a:{x:3,y:1},b:{x:1,y:4},radius:1};
 floor.dimensions.push(d);
 translateElement(floor,d.id,2,1);
 assert.deepEqual(d.vertex,{x:3,y:2});
 rotateElement(floor,d.id,35);
 near(angleValue(d),90);
 const {x,y}=d.vertex;
 resizeElement(floor,d.id,'radius',{x:x+2,y});
 near(d.radius,2);
 const saved=validateProject(JSON.parse(JSON.stringify(project))).floors[0];
 assert.deepEqual(saved.dimensions[0],d);
 const svg=exportSVG(saved);
 assert.match(svg,/class="angle-label"[^>]*>90°<\/text>/);
 assert.doesNotMatch(svg,/data-handle/);
 d.a={...d.vertex};
 assert.throws(()=>validateProject(project));
});

test('all-floor plan fits noninteractive references and retains distinct material patterns',()=>{
 const floor=createEmptyProject().floors[0],upper=createEmptyProject().floors[0];
 upper.elevation=3;
 upper.walls.push(wall('upper-wall',[42,1],[44,1],.3));
 for(const [i,material] of ['Кирпич','Газобетон','Бетон','Дерево'].entries()){
  floor.walls.push({...wall('wall-'+i,[0,i],[2,i],.3),material});
 }
 const html=renderPlan(floor,{referenceFloors:[upper]}).content;
 assert.match(html,/class="reference-floor"[^>]*pointer-events="none"/);
 assert.doesNotMatch(html,/data-element="upper-wall"/);
 for(const pattern of ['brick','block','concrete','wood'])assert.ok(html.includes(`fill="url(#material-${pattern})"`));
 assert.ok(planBounds(floor,[upper]).w>45);
});
