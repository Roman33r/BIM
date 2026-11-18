import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,validateProject,wallSegments,canPlaceOpening,projectPoint,polygonArea} from '../model.js';
import {exportSVG} from '../plan.js';

test('demo project survives a JSON round trip with stable object identifiers',()=>{const project=createDemo();assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project))),project);});
test('wall geometry excludes hosted openings and preserves exact lengths',()=>{const wall=createDemo().floors[0].walls[1];assert.deepEqual(wallSegments(wall),[[0,1.0999999999999999],[2.7,5.5],[7.9,9]]);});
test('opening placement rejects collisions, edges and insufficient wall height',()=>{const wall=createDemo().floors[0].walls[1],opening={id:'new',kind:'window',position:4,width:1,height:1.5,sill:.9};assert.equal(canPlaceOpening(wall,opening),true);assert.equal(canPlaceOpening(wall,{...opening,position:2}),false);assert.equal(canPlaceOpening(wall,{...opening,position:.2}),false);assert.equal(canPlaceOpening(wall,{...opening,height:3}),false);});
test('project validation rejects dangling geometry conditions and duplicate IDs',()=>{const a=createDemo();a.floors[0].walls[1].height=1;assert.throws(()=>validateProject(a));const b=createDemo();b.floors[0].walls[1].id=b.floors[0].walls[0].id;assert.throws(()=>validateProject(b));const c=createDemo();c.floors[0].walls[0].a.x=Infinity;assert.throws(()=>validateProject(c));});
test('projection onto a wall clamps to the segment',()=>{const w={a:{x:0,y:0},b:{x:0,y:10}};assert.deepEqual(projectPoint({x:2,y:5},w),{x:0,y:5,distance:5,offset:2});assert.equal(projectPoint({x:0,y:12},w).distance,10);});
test('polygon area is independent of vertex winding',()=>{const p=[{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}];assert.equal(polygonArea(p),12);assert.equal(polygonArea([...p].reverse()),12);});
test('SVG export escapes imported room labels',()=>{const p=createDemo();p.floors[0].rooms[0].name='<script>alert(1)</script>';const svg=exportSVG(p.floors[0],{labels:true});assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));});
