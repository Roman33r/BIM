import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeStructure,memberProfile,rimBoardSegments} from '../structures.js';
import {createEmptyProject,validateProject} from '../model.js';
import {elementFootprint,rotatePoint} from '../transforms.js';
import {renderPlan} from '../plan.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const bounds=(e,board)=>{
 const points=elementFootprint({...e,...board});
 return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
};

test('rim beams consist of three full size boards and preserve the editable package width',()=>{
 const project=createEmptyProject(),floor=project.floors[0],e=makeStructure('rim','rim',[{x:0,y:0},{x:4,y:0}]);
 near(e.thickness,.15);near(e.height,.2);
 const profile=memberProfile(e),boards=rimBoardSegments(e);
 assert.equal(profile.length,3);assert.equal(boards.length,3);
 for(const board of boards){near(board.thickness,.05);near(board.top-board.bottom,.2);}
 near(bounds(e,boards[0]).top,-.075);near(bounds(e,boards[2]).bottom,.075);
 floor.structures.push(e);validateProject(project);
 const svg=renderPlan(floor,{textures:false}).content;
 assert.equal((svg.match(/class="rim-board"/g)||[]).length,3);
 assert.doesNotMatch(svg,/fill="url\(#material-wood\)"/);
 e.thickness=.21;e.height=.25;
 for(const board of rimBoardSegments(e)){near(board.thickness,.07);near(board.top,.25);}
 validateProject(JSON.parse(JSON.stringify(project)));
});

test('perpendicular rim corners stagger their boards without overlapping for either endpoint order',()=>{
 for(const angle of [0,90,180,270])for(const reverseA of [false,true])for(const reverseB of [false,true]){
  const origin={x:2,y:3},turn=p=>rotatePoint(p,origin,angle);
  const a=[origin,{x:6,y:3}].map(turn),b=[origin,{x:2,y:6}].map(turn);
  const h=makeStructure('rim','horizontal',reverseA?a.reverse():a),v=makeStructure('rim','vertical',reverseB?b.reverse():b),members=[h,v];
  const hb=rimBoardSegments(h,members),vb=rimBoardSegments(v,members);
  for(const p of hb)for(const q of vb){
   const x=bounds(h,p),y=bounds(v,q);
   const overlap=Math.max(0,Math.min(x.right,y.right)-Math.max(x.left,y.left))*Math.max(0,Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top));
   near(overlap,0);
  }
  assert.equal(new Set(hb.map(p=>Math.round(Math.hypot(p.b.x-p.a.x,p.b.y-p.a.y)*1e6))).size,3);
 }
});

test('a rim beam ends at the outer face of a perpendicular member at a T junction',()=>{
 const h=makeStructure('rim','h',[{x:0,y:0},{x:4,y:0}]),v=makeStructure('rim','v',[{x:2,y:0},{x:2,y:3}]);
 for(const board of rimBoardSegments(v,[h,v]))near(board.a.y,.075);
 for(const board of rimBoardSegments(h,[h,v])){near(board.a.x,0);near(board.b.x,4);}
});
