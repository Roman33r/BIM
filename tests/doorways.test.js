import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyProject,validateProject,wallBlocks,canPlaceOpening} from '../model.js';
import {setOpeningDoor} from '../elements.js';
import {renderPlan,exportSVG} from '../plan.js';

function fixture(){
 const project=createEmptyProject(),floor=project.floors[0];
 const opening={id:'opening',kind:'doorway',name:'Дверной проём',position:2,width:1.437,height:2.173,sill:0};
 const wall={id:'wall',kind:'wall',name:'Стена',a:{x:0,y:0},b:{x:4,y:0},height:3,thickness:.3,material:'Кирпич',openings:[opening]};
 floor.walls.push(wall);
 return {project,floor,wall,opening};
}

test('an empty doorway cuts the wall up to the specified height and across the full width',()=>{
 const {project,wall,opening}=fixture();
 validateProject(project);
 const start=opening.position-opening.width/2,end=opening.position+opening.width/2;
 assert.deepEqual(wallBlocks(wall),[
  {start:0,end:start,bottom:0,top:3},
  {start:end,end:4,bottom:0,top:3},
  {start,end,bottom:2.173,top:3}
 ]);
 assert.equal(wallBlocks(wall,1.15).length,2);
 assert.equal(canPlaceOpening(wall,{...opening,id:'neighbor',position:2.2}),false);
 opening.sill=.2;
 assert.ok(wallBlocks(wall).some(block=>block.start===start&&block.bottom===0&&block.top===.2));
});

test('installing and removing the door leaves the cut and opening ID intact',()=>{
 const {project,floor,wall,opening}=fixture();
 const blocks=wallBlocks(wall);
 const before=renderPlan(floor).content;
 assert.match(before,/data-opening-kind="doorway"[^>]*><rect[^>]*fill="transparent"/);
 const selected=renderPlan(floor,{selectedId:opening.id,interactive:true}).content;
 assert.match(selected,/1437 × 2173 мм/);
 assert.equal(setOpeningDoor(opening,true),true);
 assert.equal(setOpeningDoor(opening,true),false);
 assert.equal(opening.name,'Дверь');
 assert.deepEqual(wallBlocks(wall),blocks);
 const withDoor=validateProject(JSON.parse(JSON.stringify(project))).floors[0];
 assert.match(renderPlan(withDoor).content,/data-opening-kind="door"[^>]*><rect[^>]*\/><path/);
 assert.equal(setOpeningDoor(opening,false),true);
 assert.equal(opening.id,'opening');
 assert.deepEqual(wallBlocks(wall),blocks);
 assert.equal(renderPlan(floor).content,before);
});

test('white surfaces remove material fills from the plan and SVG without changing the project',()=>{
 const {floor,wall}=fixture();
 floor.slabs.push({id:'slab',kind:'slab',name:'Плита',material:'Дерево',thickness:.2,
  points:[{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}]});
 const preview=renderPlan(floor,{textures:false,dark:true}).content;
 assert.match(preview,/<polygon[^>]*fill="#fff"[^>]*data-element="slab"/);
 assert.match(preview,/<rect[^>]*height="0.3" fill="#fff"/);
 assert.doesNotMatch(exportSVG(floor,{textures:false}),/material-brick|material-wood/);
 assert.match(renderPlan(floor).content,/fill="url\(#material-brick\)"/);
 assert.equal(wall.material,'Кирпич');
});
