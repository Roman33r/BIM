import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyProject,createDemo,validateProject} from '../model.js';
import {makeStructure} from '../structures.js';
import {findElement} from '../elements.js';
import {commonProperties,applyBulkProperty} from '../bulk-properties.js';
import {visibleFloor,setGroupVisibility,isElementShown} from '../visibility.js';
import {buildEstimate,estimateCSV} from '../estimate.js';
import {renderPlan} from '../plan.js';
import {renderOrthographic,projectedElements} from '../views.js';
import {snapTargets} from '../snapping.js';
import {editorOverlay} from '../editor-overlay.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7);
function fixture(){const project=createEmptyProject(),floor=project.floors[0];for(let i=0;i<3;i++)floor.structures.push(makeStructure('screwPile','pile'+i,[{x:i*1.5,y:0}]));return {project,floor};}
test('bulk pile properties distinguish mixed values and update only the edited value',()=>{
 const {project,floor}=fixture(),items=floor.structures.map(element=>({element}));items[1].element.height=3;
 assert.equal(commonProperties(items).find(f=>f.key==='height').value,null);
 applyBulkProperty(floor,['pile0','pile1','pile2'],'diameter',.133);validateProject(project);
 assert.deepEqual(floor.structures.map(e=>e.diameter),[.133,.133,.133]);assert.equal(items[1].element.height,3);
 applyBulkProperty(floor,['pile0','pile1','pile2'],'dz',.5);validateProject(project);assert.deepEqual(floor.structures.map(e=>e.elevation),[.5,.5,.5]);
 applyBulkProperty(floor,['pile0','pile1','pile2'],'dx',2);near(floor.structures[1].x-floor.structures[0].x,1.5);
});
test('bulk changes validate the whole project and keep linked cap elevations consistent',()=>{
 const {project,floor}=fixture();const cap=makeStructure('pileCap','cap',[{x:0,y:0}]);cap.pileId='pile0';floor.structures.push(cap);
 applyBulkProperty(floor,['pile0','pile1'],'elevation',.25);validateProject(project);near(cap.elevation,.27);
 applyBulkProperty(floor,['pile0','pile1'],'diameter',.4);assert.throws(()=>validateProject(project));
});
test('visibility hides floors, categories and individual items in plans, projections and snapping',()=>{
 const {project,floor}=fixture();setGroupVisibility(floor,'foundation',false);
 assert.equal(visibleFloor(floor).structures.length,0);assert.equal(projectedElements(floor,'front').length,0);assert.equal(snapTargets(floor).points.length,0);assert.doesNotMatch(renderPlan(floor).content,/data-element="pile/);
 setGroupVisibility(floor,'foundation',true);floor.structures[0].hidden=true;
 assert.equal(visibleFloor(floor).structures.length,2);assert.doesNotMatch(renderOrthographic([floor],'front'),/data-element="pile0"/);
 floor.hidden=true;assert.equal(visibleFloor(floor).structures.length,0);validateProject(JSON.parse(JSON.stringify(project)));
});
test('hiding a door keeps its real wall opening and hiding its host also hides the door',()=>{
 const p=createDemo(),f=p.floors[0],wall=f.walls.find(w=>w.openings.some(o=>o.kind==='door')),door=wall.openings.find(o=>o.kind==='door');door.hidden=true;
 const visible=visibleFloor(f),host=visible.walls.find(w=>w.id===wall.id);assert.equal(host.openings.length,wall.openings.length);assert.equal(host.openings.find(o=>o.id===door.id).hidden,true);
 assert.doesNotMatch(renderPlan(f).content,new RegExp('data-element="'+door.id+'"'));
 door.hidden=false;wall.hidden=true;assert.equal(isElementShown(f,door,wall),false);assert.equal(findElement(f,door.id).element,door);
});
test('hidden supports remain available for board geometry without rendering them',()=>{
 const {project,floor}=fixture(),a=makeStructure('pileCap','cap-a',[{x:0,y:0}]),b=makeStructure('pileCap','cap-b',[{x:3,y:0}]);
 const board=makeStructure('rimBoard','board',[{x:0,y:0},{x:3,y:0}]);board.mounts=[{end:'a',capId:a.id,holeIndex:0},{end:'b',capId:b.id,holeIndex:0}];floor.structures.push(a,b,board);validateProject(project);
 const path=()=>renderPlan(floor).content.match(/<path class="mounted-rim-board" d="([^"]+)"/)[1],before=path();
 a.hidden=true;b.hidden=true;assert.equal(path(),before);assert.doesNotMatch(renderPlan(floor).content,/data-element="cap-a"/);
});
test('estimate counts hidden products, separates sizes and expands rim packages into boards',()=>{
 const {project,floor}=fixture();floor.structures[0].hidden=true;floor.structures[1].height=3;
 floor.structures.push(makeStructure('rim','rim',[{x:0,y:1},{x:3,y:1}]));
 const rows=buildEstimate(project);assert.equal(rows.filter(r=>r.name==='Винтовая свая').reduce((n,r)=>n+r.quantity,0),3);
 assert.equal(rows.filter(r=>r.name==='Винтовая свая').length,2);assert.equal(rows.find(r=>r.name==='Доска обвязки').quantity,3);
 const row=rows[0];project.estimatePrices={[row.key]:125.5};assert.equal(buildEstimate(project)[0].total,row.quantity*125.5);
 const second=structuredClone(createEmptyProject().floors[0]);second.id='floor2';project.floors.push(second);assert.equal(buildEstimate(project,'floor2').length,0);validateProject(project);
 assert.ok(estimateCSV(buildEstimate(project)).startsWith('\ufeff'));assert.match(estimateCSV(buildEstimate(project)),/Количество, шт./);
});
test('malformed persisted prices or visibility settings are rejected',()=>{
 const {project,floor}=fixture();floor.hiddenKinds=['unknown'];assert.throws(()=>validateProject(project));delete floor.hiddenKinds;
 project.estimatePrices={a:-1};assert.throws(()=>validateProject(project));
});
test('editing controls have no oversized invisible hit circles',()=>{
 const {floor}=fixture(),board=makeStructure('rimBoard','board',[{x:0,y:0},{x:0,y:4}]);floor.structures.push(board);
 const svg=editorOverlay(floor,{selectedId:'board',interactive:true,unit:.01});assert.match(svg,/fill="transparent" pointer-events="none"/);assert.doesNotMatch(svg,/r="0.11"/);
});
