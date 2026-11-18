import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,createEmptyProject,validateProject,clone,canPlaceOpening} from '../model.js';
import {listElements,findElement,translateElement,translateSelection,elementPosition,makeFurniture} from '../elements.js';
import {renderPlan,planBounds} from '../plan.js';
import {selectInPlan,selectionBounds} from '../selection.js';
import {snapTargets} from '../snapping.js';
import {loadProjects,saveProjects,CATALOG_KEY,LEGACY_KEY} from '../project-store.js';

function memoryStorage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('a new project has one genuinely empty floor, including after validation and rendering',()=>{const p=createEmptyProject('Студия');validateProject(p);assert.equal(p.floors.length,1);assert.equal(listElements(p.floors[0]).length,0);const html=renderPlan(p.floors[0]).content;assert.ok(!html.includes('data-element='));assert.ok(!html.includes('Терраса'));});
test('every demo element has a unique selectable plan representation',()=>{const p=createDemo(),f=p.floors[0],ids=listElements(f).map(e=>e.id),html=renderPlan(f,{labels:true,dimensions:true}).content;assert.equal(new Set(ids).size,ids.length);for(const id of ids){assert.ok(findElement(f,id),id);assert.ok(html.includes(`data-element="${id}"`),id);}});
test('moving a wall translates both endpoints and preserves hosted opening coordinates',()=>{const f=createDemo().floors[0],wall=f.walls[1],o=wall.openings[0],before=elementPosition(o,wall),oldLength=Math.hypot(wall.b.x-wall.a.x,wall.b.y-wall.a.y);translateElement(f,wall.id,1.25,-.5);assert.deepEqual(elementPosition(o,wall),{x:before.x+1.25,y:before.y-.5});assert.equal(Math.hypot(wall.b.x-wall.a.x,wall.b.y-wall.a.y),oldLength);assert.ok(canPlaceOpening(wall,o,o.id));});
test('openings move along their host and stop at neighbors and wall edges',()=>{const p=createDemo(),f=p.floors[0],wall=f.walls[1],o=wall.openings[0];translateElement(f,o.id,100,100);assert.ok(canPlaceOpening(wall,o,o.id));assert.ok(o.position<wall.openings[1].position);translateElement(f,o.id,-100,-100);assert.ok(o.position>=o.width/2+.08);assert.ok(canPlaceOpening(wall,o,o.id));validateProject(p);});
test('furniture, rooms, slabs and dimensions all translate without changing their sizes',()=>{const p=createDemo(),f=p.floors[0];for(const e of [f.furniture[0],f.rooms[0],f.slabs[0],f.dimensions[0]]){const pos=elementPosition(e);translateElement(f,e.id,2,.75);assert.deepEqual(elementPosition(e),{x:pos.x+2,y:pos.y+.75});}validateProject(p);});
test('legacy JSON receives selectable model furniture once, without duplication on reload',()=>{const old=createDemo();delete old.contentVersion;delete old.id;for(const f of old.floors){delete f.furniture;f.slabs=f.slabs.slice(0,1);f.dimensions=[];f.rooms.forEach(r=>{delete r.id;delete r.kind;});}const first=validateProject(old),counts=first.floors.map(f=>listElements(f).length);assert.deepEqual(validateProject(JSON.parse(JSON.stringify(first))).floors.map(f=>listElements(f).length),counts);});
test('project library keeps independent projects and restores the active one',()=>{const storage=memoryStorage(),a=createDemo(),b=createEmptyProject('Новый дом');let projects=saveProjects(storage,[],a);projects=saveProjects(storage,projects,b);b.floors[0].furniture.push(clone(a.floors[0].furniture[0]));projects=saveProjects(storage,projects,b);const loaded=loadProjects(storage);assert.equal(loaded.projects.length,2);assert.equal(loaded.project.id,b.id);assert.equal(loaded.projects.find(p=>p.id===a.id).name,a.name);assert.equal(loaded.project.floors[0].furniture.length,1);});
test('legacy local project is preserved when creating a new project',()=>{const storage=memoryStorage(),old=createDemo();storage.setItem(LEGACY_KEY,JSON.stringify(old));const loaded=loadProjects(storage);saveProjects(storage,loaded.projects,createEmptyProject());assert.equal(loadProjects(storage).projects.length,2);assert.equal(JSON.parse(storage.getItem(LEGACY_KEY)).id,old.id);});
test('a failed catalog write preserves the previously saved projects',()=>{const storage=memoryStorage(),a=createDemo();saveProjects(storage,[],a);const before=storage.getItem(CATALOG_KEY);storage.setItem=()=>{throw new Error('QuotaExceededError');};assert.throws(()=>saveProjects(storage,[a],createEmptyProject()));assert.equal(storage.getItem(CATALOG_KEY),before);});
test('fit and export bounds include objects moved beyond the original building',()=>{const p=createDemo(),f=p.floors[0],e=f.furniture[0];translateElement(f,e.id,70,-30);const b=planBounds(f);assert.ok(b.x<=e.x&&b.x+b.w>=e.x+e.w);assert.ok(b.y<=e.y&&b.y+b.h>=e.y+e.d);});

test('marquee selects complete objects left to right and crossed outlines right to left',()=>{
 const floor=createEmptyProject().floors[0];
 floor.furniture.push(makeFurniture('table',1,1,'table'),makeFurniture('desk',3,1,'desk'));
 assert.deepEqual(selectInPlan(floor,selectionBounds({x:0,y:0},{x:3.5,y:3})),['table']);
 assert.deepEqual(selectInPlan(floor,selectionBounds({x:3.5,y:0},{x:0,y:3})),['table','desk']);
});

test('a group move carries hosted openings once and keeps the spacing of openings on one wall',()=>{
 const p=createDemo(),f=p.floors[0],wall=f.walls[1],[first,second]=wall.openings;
 const original=elementPosition(first,wall);
 translateSelection(f,[wall.id,first.id],1,1);
 assert.deepEqual(elementPosition(first,wall),{x:original.x+1,y:original.y+1});
 const spacing=second.position-first.position;
 translateSelection(f,[first.id,second.id],0,2);
 assert.ok(Math.abs(second.position-first.position-spacing)<1e-9);
 assert.ok(Math.abs(second.position+second.width/2-(9-.08))<1e-7);
 validateProject(p);
});

test('axes are visible without a selection and the type filter also excludes axis targets',()=>{
 const floor=createDemo().floors[0];
 floor.furniture[0].showAxes=false;
 const axisTypes={furniture:false};
 const axisCount=html=>(html.match(/class="symmetry-axis"/g)||[]).length;
 const all=axisCount(renderPlan(floor,{axes:true}).content);
 const filtered=axisCount(renderPlan(floor,{axes:true,axisTypes}).content);
 assert.equal(all-filtered,2*(floor.furniture.length-1));
 assert.ok(filtered>0);
 assert.equal(axisCount(renderPlan(floor,{axes:false}).content),0);
 const targets=snapTargets(floor,null,true,{axisTypes});
 assert.ok(targets.points.some(p=>p.id===floor.furniture[0].id));
 assert.ok(!targets.lines.some(p=>p.id===floor.furniture[1].id));
});
