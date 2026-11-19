import {createDemo,createEmptyProject,clone,wallLength,uid,projectPoint,canPlaceOpening,polygonArea,validateProject} from './model.js';
import {renderPlan,exportSVG,planBounds} from './plan.js';
import {hydrateIcons} from './icons.js';
import {findElement,listElements,elementPosition,translateElement,translateSelection,makeFurniture,setOpeningDoor,FURNITURE_TYPES} from './elements.js';
import {loadProjects,saveProjects,CATALOG_KEY,LEGACY_KEY} from './project-store.js';
import {elementFrame,elementAngle,elementAnchors,transformHandles,resizeElement,rotateElement,normalAngle,length,sub} from './transforms.js';
import {snapTargets,snapPoint,snapTranslation,snapWallTranslation} from './snapping.js';
import {AXIS_TYPES,selectInPlan,selectionBounds,showSelectionBox} from './selection.js';
import {angleLabel,angleRadius,angleValue} from './annotations.js';
import {materialNames} from './materials.js';

const $=id=>document.getElementById(id),$$=selector=>[...document.querySelectorAll(selector)];
const STORAGE_KEY=LEGACY_KEY,PREFS_KEY='bim-workspace-preferences-v1';
const fmt=(value,digits=0)=>Number(value).toLocaleString('ru-RU',{maximumFractionDigits:digits});
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let project=createDemo(),projects=[],loadWarning='',preferences={dark:false,grid:true,labels:true,dimensions:true,snap:true,axes:true,guides:true,allFloors:false,textures:true,axisTypes:{}};
try{({project,projects}=loadProjects(localStorage));const prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}');for(const k of Object.keys(preferences))if(typeof prefs[k]==='boolean'&&k!=='axisTypes')preferences[k]=prefs[k];for(const kind of Object.keys(AXIS_TYPES))if(prefs.axisTypes?.[kind]===false)preferences.axisTypes[kind]=false;}catch{loadWarning='Не удалось прочитать локальное сохранение. Открыт пример; исходное сохранение не изменено.';}
let floorId=project.floors[0].id,tool='select',view='plan',draft=[],hover=null,pan=null,spaceHeld=false,section=false,scene=null,scenePromise=null;
let selectedIds=new Set(project.floors[0].walls.filter(w=>w.id==='СТ-014').map(w=>w.id)),marquee=null;
let history=[],future=[],toastTimer,saveFailed=false,movement=null,editorFeedback={},baseCamera={x:-2.1,y:-2.4,w:16.2,h:16},camera={...baseCamera};
let cursorPoint={x:0,y:0};
const floor=()=>project.floors.find(f=>f.id===floorId)||project.floors[0];
const otherFloors=()=>preferences.allFloors?project.floors.filter(f=>f.id!==floorId):[];
const elevation=value=>(value===0?'±':value>0?'+':'')+fmt(value,3);
function singleSelection(){return selectedIds.size===1?selectedIds.values().next().value:null;}
function selected(){return findElement(floor(),singleSelection());}
function setSelection(ids){selectedIds=new Set(ids);}
function snapshot(){return {project:clone(project),floorId,selection:[...selectedIds]};}
function restore(state){const changedFloor=floorId!==state.floorId;project=clone(state.project);floorId=state.floorId;setSelection(state.selection);draft=[];hover=null;editorFeedback={};save();if(changedFloor)fitPlan();render();}
function mutate(action,message){const before=snapshot();try{action();validateProject(project);}catch(error){project=before.project;floorId=before.floorId;setSelection(before.selection);render();toast(error.message||'Не удалось изменить элемент.');return false;}history.push(before);if(history.length>60)history.shift();future=[];project.updatedAt=new Date().toISOString();save();render();if(message)toast(message);return true;}
function save(){try{projects=saveProjects(localStorage,projects,project);saveFailed=false;$('save-state').querySelector('span').textContent='Сохранено на устройстве';return true;}catch{saveFailed=true;$('save-state').querySelector('span').textContent='Не сохранено';toast('Хранилище браузера недоступно. Скачайте проект через «Экспорт».');return false;}}
function savePreferences(){try{localStorage.setItem(PREFS_KEY,JSON.stringify(preferences));}catch{/* Preferences are optional. */}}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function sceneOptions(){
 return {dark:preferences.dark,section,labels:preferences.labels,dimensions:preferences.dimensions,
  axes:preferences.axes,axisTypes:preferences.axisTypes,feedback:editorFeedback,interactive:tool==='select',
  floors:preferences.allFloors?project.floors:null,textures:preferences.textures};
}
function refreshScene(){if(view!=='plan')scene?.update(floor(),selectedIds,sceneOptions());}
function selectMany(ids,extend=false){
 setSelection(extend?[...selectedIds,...ids]:ids);
 editorFeedback={};
 renderPlanView();renderInspector();refreshScene();updateEditButtons();
}
function select(id,extend=false){
 if(extend&&id){const next=new Set(selectedIds);if(next.has(id))next.delete(id);else next.add(id);selectMany(next);}
 else selectMany(id?[id]:[]);
}
function updateEditButtons(){$('undo').disabled=!history.length;$('redo').disabled=!future.length;$('copy-button').disabled=!selectedIds.size;$('delete-button').disabled=!selectedIds.size;}
function fitPlan(){baseCamera=planBounds(floor(),otherFloors());camera={...baseCamera};renderPlanView();}
function updateViewBox(){$('plan-svg').setAttribute('viewBox',`${camera.x} ${camera.y} ${camera.w} ${camera.h}`);$('zoom-value').textContent=fmt(baseCamera.w/camera.w*100)+'%';}
function zoom(factor,center){const next=camera.w*factor;if(next<2||next>100)return;const anchor=center||{x:camera.x+camera.w/2,y:camera.y+camera.h/2};camera.x=anchor.x+(camera.x-anchor.x)*factor;camera.y=anchor.y+(camera.y-anchor.y)*factor;camera.w*=factor;camera.h*=factor;renderPlanView();}
function pixelUnit(){return 1/($('plan-svg').getScreenCTM()?.a||50);}
function renderPlanView(){
 updateViewBox();
 const points=draft.length?[...draft,...(hover?[hover]:[])]:[];
 $('plan-svg').innerHTML=renderPlan(floor(),{selectedId:singleSelection(),selectedIds,grid:preferences.grid,labels:preferences.labels,dimensions:preferences.dimensions||tool==='angle',dark:preferences.dark,textures:preferences.textures,interactive:tool==='select',axes:preferences.axes,axisTypes:preferences.axisTypes,unit:pixelUnit(),feedback:editorFeedback,bounds:camera,referenceFloors:otherFloors(),draft:tool==='angle'?[]:points,angleDraft:tool==='angle'?points:null}).content;
}

const floorsByElevation=()=>[...project.floors].sort((a,b)=>b.elevation-a.elevation);
const floorLabel=f=>`${f.name} · ${elevation(f.elevation)} м`;
function floorOptions(){
 return floorsByElevation().map(f=>`<option value="${escapeHTML(f.id)}" ${f.id===floorId?'selected':''}>${escapeHTML(floorLabel(f))}</option>`).join('');
}
function chooseFloor(id){
 if(id===floorId||!project.floors.some(level=>level.id===id))return;
 floorId=id;setSelection([]);draft=[];hover=null;editorFeedback={};section=false;
 if(!preferences.allFloors)fitPlan();
 render();
}
function renderFloors(){
 const list=$('floors-list');list.replaceChildren();
 for(const f of floorsByElevation()){
  const button=document.createElement('button');button.className='floor-item'+(f.id===floorId?' active':'');
  button.dataset.floor=f.id;button.title=floorLabel(f);
  button.setAttribute('aria-pressed',String(f.id===floorId));
  button.innerHTML='<i data-icon="layers"></i><span></span>'+(f.id===floorId?'<i class="floor-eye" data-icon="eye"></i>':'');
  button.querySelector('span').textContent=f.name;button.addEventListener('click',()=>chooseFloor(f.id));list.append(button);
 }
 hydrateIcons(list);
 $('working-floor').innerHTML=floorOptions();
 $('show-all-floors').checked=preferences.allFloors;
}
function render(){
 document.body.classList.toggle('dark',preferences.dark);$('project-title').textContent=project.name;$('tree-project-title').textContent=project.name;
 document.title=project.name+' — Проект';const level=floor();
 $('plan-title').textContent=(preferences.allFloors?'Все этажи · Рабочий: ':'План · ')+level.name;
 $('floor-elevation').textContent=elevation(level.elevation)+' м';
 $('model-title').textContent='3D · '+(section?'Отсечка':preferences.allFloors?'Все этажи':level.name);
 $('element-count').textContent=`${level.walls.length} стен · ${level.walls.reduce((s,w)=>s+w.openings.length,0)} проёмов`;
 renderFloors();renderPlanView();renderInspector();updateToolHint();updateEditButtons();applyPreferenceButtons();updateCoordinates();refreshScene();
}
function propertyInput(key,label,value,{min=0,max=100000,step=10,unit='мм'}={}){return `<div class="property-row"><label for="property-${key}">${label}</label><div class="input-unit"><input id="property-${key}" data-property="${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" aria-label="${label}"><span>${unit}</span></div></div>`;}
function sectionTitle(title){return `<h2>${title}<i data-icon="chevron"></i></h2>`;}
function renderInspector(){
 renderElementList();
 const node=$('inspector-content'),item=selected();
 if(selectedIds.size>1){
  node.innerHTML=`<div class="empty-selection"><i data-icon="cursor"></i><h2>Выбрано объектов: ${selectedIds.size}</h2><p>Перетащите любой выбранный объект или используйте стрелки. Ctrl+Z отменяет перенос группы.</p></div>`;
  hydrateIcons(node);
  return;
 }
 if(!item){node.innerHTML=`<div class="empty-selection"><i data-icon="cursor"></i><h2>Выберите элемент</h2><p>Нажмите на элемент и перетащите его мышью. Любой объект можно также выбрать в списке слева.</p><div class="project-summary"><div><span>Этаж</span><strong>${escapeHTML(floor().name)}</strong></div><div><span>Элементов</span><strong>${listElements(floor()).length}</strong></div></div></div>`;hydrateIcons(node);return;}
 const {element:e,host}=item,kind=elementIcon(e),pos=elementPosition(e,host);
 let body=`<div class="element-title"><i data-icon="${kind}"></i><div><strong>${escapeHTML(e.name)}</strong><small>${escapeHTML(e.id.length>18?e.id.slice(0,14)+'…':e.id)}</small></div></div><section class="property-section">${sectionTitle('Общие')}`;
 if(e.kind==='wall')body+=propertyInput('thickness','Толщина',Math.round(e.thickness*1000),{min:50,max:1500})+propertyInput('height','Высота',Math.round(e.height*1000),{min:1000,max:15000})+propertyInput('length','Длина',Math.round(wallLength(e)*1000),{min:200,max:100000});
 else if(host)body+=propertyInput('width','Ширина проёма',Math.round(e.width*1000),{min:300,max:10000,step:1})+propertyInput('height','Высота проёма',Math.round(e.height*1000),{min:300,max:15000,step:1})+propertyInput('sill','Отметка низа',Math.round(e.sill*1000),{min:0,max:15000,step:1})+propertyInput('position','Положение',Math.round(e.position*1000),{min:0,max:100000,step:1});
 else if(e.kind==='slab')body+=propertyInput('thickness','Толщина',Math.round(e.thickness*1000),{min:50,max:1500})+`<div class="property-row"><span class="field-label">Площадь</span><span class="value-muted">${fmt(polygonArea(e.points),2)} м²</span></div>`;
 else if(e.kind==='furniture')body+=propertyInput('w','Ширина',Math.round(e.w*1000),{min:50,max:30000})+propertyInput('d','Глубина',Math.round(e.d*1000),{min:50,max:30000})+propertyInput('height','Высота',Math.round(e.height*1000),{min:5,max:15000});
 else if(e.kind==='room')body+=propertyInput('w','Ширина',Math.round(e.w*1000),{min:100,max:100000})+propertyInput('h','Глубина',Math.round(e.h*1000),{min:100,max:100000})+`<div class="property-row"><span class="field-label">Площадь</span><span class="value-muted">${fmt(e.w*e.h,2)} м²</span></div>`;
 else if(e.mode==='angle')body+=`<div class="property-row"><span class="field-label">Угол</span><span class="value-muted">${angleLabel(angleValue(e))}</span></div>`+propertyInput('radius','Радиус дуги',Math.round(e.radius*1000),{min:50,max:100000,step:1});
 else if(e.kind==='dimension')body+=`<div class="property-row"><span class="field-label">Длина</span><span class="value-muted">${fmt(wallLength(e)*1000)} мм</span></div>`+propertyInput('offset','Отступ',Math.round(e.offset*1000),{min:-100000,max:100000});
 if(['wall','slab'].includes(e.kind)){const materials=[...new Set([e.material,...materialNames])];body+=`<div class="property-row"><label for="property-material">Материал</label><select id="property-material" data-property="material">${materials.map(m=>`<option ${m===e.material?'selected':''}>${escapeHTML(m)}</option>`).join('')}</select></div>`;}
 body+=host?`<div class="property-row"><span class="field-label">Этаж стены</span><span class="value-muted">${escapeHTML(floor().name)}</span></div>`:`<div class="property-row"><label for="property-floorId">Этаж</label><select id="property-floorId" data-property="floorId">${floorOptions()}</select></div>`;
 if(e.kind==='doorway'||e.kind==='door'){
  const empty=e.kind==='doorway';
  body+=`<button type="button" class="button ${empty?'primary':''} opening-action" id="door-fill-action"><i data-icon="${empty?'door':'doorway'}"></i>${empty?'Вставить дверь':'Вынуть дверь'}</button>`;
 }
 body+='</section>';
 if(!host)body+=`<section class="property-section">${sectionTitle('Положение')}${propertyInput('x','Координата X',Math.round(pos.x*1000),{min:-1000000,max:1000000})}${propertyInput('y','Координата Y',Math.round(pos.y*1000),{min:-1000000,max:1000000})}<p class="property-note">Перетащите элемент мышью или задайте координаты. Стрелки — шаг 50 мм, Shift — 500 мм.</p></section>`;
 if(e.kind==='wall')body+=`<section class="property-section">${sectionTitle('Конструкция')}<div class="property-row"><label for="property-loadBearing">Несущая стена</label><input class="toggle" id="property-loadBearing" data-property="loadBearing" type="checkbox" ${e.loadBearing?'checked':''}></div><div class="property-row"><span class="field-label">Проёмы</span><span class="value-muted">${e.openings.length}</span></div><div class="property-row"><span class="field-label">Объём брутто</span><span class="value-muted">${fmt(wallLength(e)*e.thickness*e.height,2)} м³</span></div></section>`;
 if(host)body+=`<section class="property-section">${sectionTitle('Размещение')}<div class="property-row"><span class="field-label">Основа</span><span class="value-muted">${escapeHTML(host.id.slice(0,14))}</span></div><p class="property-note">Положение отсчитывается от начала оси стены. Проём сохраняет связь со стеной.</p></section>`;
 if(!host)body+=`<section class="property-section">${sectionTitle('Поворот')}<div class="property-row"><span class="field-label">Угол</span><span class="value-muted">${fmt(elementAngle(e),1)}°</span></div></section>`;
 body+=`<section class="property-section">${sectionTitle('Привязки')}<div class="property-row"><label for="property-showAxes">Оси симметрии</label><input class="toggle" id="property-showAxes" data-property="showAxes" type="checkbox" ${e.showAxes!==false?'checked':''}></div><p class="property-note">Ручки на плане меняют размер. Круглая ручка поворачивает элемент. Alt временно отключает привязки.</p></section>`;
 body+=`<section class="property-section">${sectionTitle('Идентификация')}<label class="element-name-label" for="element-name">Название</label><input id="element-name" class="element-name-input" data-property="name" type="text" maxlength="100" value="${escapeHTML(e.name)}"><p class="property-note">${e.kind==='wall'?'Стена перемещается вместе со своими дверями и окнами.':'Параметры и положение сохраняются в проекте.'}</p></section>`;
 node.innerHTML=body;hydrateIcons(node);node.querySelectorAll('[data-property]').forEach(input=>{input.addEventListener('change',()=>updateProperty(input));input.addEventListener('keydown',event=>{if(event.key==='Enter')input.blur();});});
 if($('door-fill-action'))$('door-fill-action').onclick=()=>changeDoor(e.id,e.kind==='doorway');
}
function updateProperty(input){const item=selected();if(!item)return;const key=input.dataset.property,value=input.type==='checkbox'?input.checked:input.tagName==='SELECT'||input.type==='text'?input.value.trim():Number(input.value)/1000;
 if(key==='floorId'){
  const target=project.floors.find(level=>level.id===input.value);
  if(!target||target===floor()||item.host)return;
  const moved=mutate(()=>{
   const source=floor()[item.collection];source.splice(source.indexOf(item.element),1);
   target[item.collection].push(item.element);floorId=target.id;draft=[];hover=null;editorFeedback={};
  },'Перенесено на этаж «'+target.name+'»');
  if(moved&&!preferences.allFloors)fitPlan();
  return;
 }
 mutate(()=>{const {element:e,host}=item;
  if(typeof value==='number'&&(!Number.isFinite(value)||input.value===''))throw new Error('Введите корректное значение.');
  if(key==='x'||key==='y'){const pos=elementPosition(e,host);translateElement(floor(),item.element.id,key==='x'?value-pos.x:0,key==='y'?value-pos.y:0);}
  else if(key==='length'){const old=wallLength(e),dx=(e.b.x-e.a.x)/old,dy=(e.b.y-e.a.y)/old;e.b={x:e.a.x+dx*value,y:e.a.y+dy*value};}else e[key]=value;
  if(host&&!canPlaceOpening(host,e,e.id))throw new Error('Проём выходит за границы стены или пересекает другой проём.');
  if(e.kind==='wall'&&e.openings.some(o=>!canPlaceOpening(e,o,o.id)))throw new Error('Размер стены не позволяет сохранить существующие проёмы.');
 });
}
async function ensureScene(){if(scene){refreshScene();scene.resize();return;}if(scenePromise)return scenePromise;scenePromise=(async()=>{try{const {createScene}=await import('./scene.js');scene=createScene($('model-container'),select,{start:beginElementDrag,move:previewElementDrag,end:finishElementDrag,cancel:cancelElementDrag,selectMany,context:showEditorMenu});refreshScene();scene.resize();}catch(error){$('model-container').innerHTML='<div class="model-error"><i data-icon="cube"></i>Не удалось запустить 3D.<br>Проверьте поддержку WebGL в браузере.<br>План и редактирование остаются доступны.</div>';hydrateIcons($('model-container'));console.error('3D initialization failed',error);}})();return scenePromise;}
function setView(next){view=next;$('viewports').dataset.mode=next;$$('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===next);button.setAttribute('aria-pressed',String(button.dataset.view===next));});if(next!=='plan')ensureScene();if(tool!=='select'&&next==='3d')setTool('select');}
const hints={select:'Перетащите элемент для переноса · Правая кнопка — меню',wall:'Укажите начало и конец стены · Shift — ортогонально · Esc — завершить',doorway:'Укажите место на стене и задайте размеры проёма',door:'Нажмите на пустой дверной проём',window:'Нажмите на стену, чтобы разместить окно',slab:'Задайте вершины контура · Enter — создать · Esc — отменить',dimension:'Укажите две точки для размера',room:'Задайте два противоположных угла помещения'};
function updateToolHint(){
 let hint=hints[tool];
 if(tool==='select'&&!listElements(floor()).length)hint='Пустой этаж · Выберите «Стена», «Плита» или добавьте мебель';
 if(tool==='slab')hint=`${floorLabel(floor())} · ${hint}`;
 if(tool==='angle')hint=['Укажите вершину угла','Укажите точку на первом луче','Укажите точку на втором луче'][draft.length];
 $('canvas-hint').textContent=hint;
 $('tool-status').textContent=tool==='select'?'Выбор элементов':hint;
}
function setTool(next){tool=next;draft=[];hover=null;editorFeedback={};$$('[data-tool]').forEach(button=>{button.classList.toggle('active',button.dataset.tool===next);button.setAttribute('aria-pressed',String(button.dataset.tool===next));});updateToolHint();$('drawing-surface').classList.toggle('drawing',next!=='select');if(next!=='select'&&view==='3d')setView('plan');renderPlanView();refreshScene();}
function worldPoint(event){const svg=$('plan-svg'),point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;return point.matrixTransform(svg.getScreenCTM().inverse());}
function snapped(point,event){let p={x:point.x,y:point.y};editorFeedback={};
 if(preferences.snap&&!event.altKey){const result=snapPoint(p,snapTargets(floor(),null,preferences.axes,sceneOptions()),pixelUnit()*8,{alignment:preferences.guides,axes:preferences.axes});editorFeedback=result;p=result.label?result.point:{x:Math.round(p.x*20)/20,y:Math.round(p.y*20)/20};}
 if(event.shiftKey&&draft.length){const start=tool==='angle'?draft[0]:draft[draft.length-1];if(Math.abs(p.x-start.x)>Math.abs(p.y-start.y))p.y=start.y;else p.x=start.x;}
 return p;}

function changeDoor(id,installed){
 const item=findElement(floor(),id);
 if(!item?.host||item.element.kind!==(installed?'doorway':'door'))return;
 mutate(()=>{setOpeningDoor(item.element,installed);setSelection([id]);},
  installed?'Дверь вставлена в проём':'Дверь вынута, проём сохранён');
}
function addDoorway(wall,distance){
 const maxWidth=Math.min(10000,Math.floor((wallLength(wall)-.16)*1000+1e-7));
 if(maxWidth<300){toast('Стена слишком короткая для дверного проёма.');return;}
 const maxHeight=Math.floor(wall.height*1000+1e-7);
 modal('Дверной проём',`<form id="doorway-form" class="floor-form">
  <label for="doorway-width">Ширина, мм</label><input id="doorway-width" type="number" required min="300" max="${maxWidth}" value="${Math.min(900,maxWidth)}">
  <label for="doorway-height">Высота, мм</label><input id="doorway-height" type="number" required min="300" max="${maxHeight}" value="${Math.min(2100,maxHeight)}">
  <p id="doorway-error" class="form-error" role="alert" hidden></p>
  <div class="modal-actions"><button class="button" id="cancel-doorway" type="button">Отмена</button><button class="button primary" type="submit">Создать проём</button></div>
 </form>`);
 $('cancel-doorway').onclick=()=>$('modal').close();
 $('doorway-form').onsubmit=event=>{
  event.preventDefault();
  const width=$('doorway-width').valueAsNumber/1000,height=$('doorway-height').valueAsNumber/1000;
  const opening={id:uid('ПР'),kind:'doorway',name:'Дверной проём',width,height,sill:0,position:distance};
  if(!canPlaceOpening(wall,opening)){
   const error=$('doorway-error');error.textContent='Проём выходит за границы стены или пересекает соседний проём.';error.hidden=false;return;
  }
  if(mutate(()=>{wall.openings.push(opening);setSelection([opening.id]);},'Дверной проём создан')){
   $('modal').close();setTool('select');
  }
 };
 $('doorway-width').select();
}
function choosePoint(p,event){
 if(tool==='door'){
  const id=event.target.closest('[data-element]')?.dataset.element;
  const item=findElement(floor(),id);
  if(item?.host&&item.element.kind==='doorway'){changeDoor(id,true);setTool('select');}
  else toast('Укажите пустой дверной проём. Его можно создать инструментом «Проём».');
  return;
 }
 if(tool==='angle'){
  const [vertex,a]=draft;
  if(vertex&&length(sub(p,vertex))<.01){toast('Укажите точку вне вершины угла.');return;}
  if(a){
   const d={id:uid('РЗ'),kind:'dimension',mode:'angle',name:'Угловой размер',vertex,a,b:p,radius:angleRadius(vertex,a,p)};
   if(angleValue(d)<.01){toast('Укажите точку на другом луче.');return;}
   draft=[];hover=null;editorFeedback={};
   mutate(()=>{floor().dimensions.push(d);setSelection([d.id]);},'Угловой размер добавлен');
  }else{
   draft.push(p);hover=null;updateToolHint();renderPlanView();
  }
  return;
 }
 if(tool==='wall'||tool==='dimension'||tool==='room'){draft.push(p);if(draft.length===2){const [a,b]=draft;draft=[];hover=null;if(Math.hypot(a.x-b.x,a.y-b.y)<.2){toast('Минимальная длина — 200 мм.');renderPlanView();return;}mutate(()=>{const id=uid(tool==='wall'?'СТ':tool==='room'?'ПМ':'РЗ');if(tool==='wall'){floor().walls.push({id,kind:'wall',name:'Новая стена',a,b,thickness:.3,height:floor().height,material:'Кирпич',loadBearing:false,openings:[]});}else if(tool==='room'){floor().rooms.push({id,kind:'room',name:'Помещение '+(floor().rooms.length+1),x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)});}else floor().dimensions.push({id,kind:'dimension',name:'Размер',a,b,offset:.5});setSelection([id]);},tool==='wall'?'Стена добавлена':tool==='room'?'Помещение добавлено':'Размер добавлен');}else renderPlanView();
 }else if(tool==='slab'){if(event.detail>1)return;draft.push(p);renderPlanView();
 }else if(tool==='doorway'||tool==='window'){
  const target=findElement(floor(),event.target.closest('[data-element]')?.dataset.element);
  const direct=target?.host||(target?.element.kind==='wall'?target.element:null);
  let nearest=null;
  for(const wall of direct?[direct]:floor().walls){const projection=projectPoint(p,wall);if(!nearest||projection.offset<nearest.projection.offset)nearest={wall,projection};}
  if(!nearest||nearest.projection.offset>.5){toast('Нажмите ближе к оси стены.');return;}
  const position=event.altKey?nearest.projection.distance:Math.round(nearest.projection.distance*20)/20;
  if(tool==='doorway'){addDoorway(nearest.wall,position);return;}
  const opening={id:uid('ОК'),kind:'window',name:'Окно',position,width:1.5,height:1.5,sill:.9};
  if(!canPlaceOpening(nearest.wall,opening)){toast('Недостаточно места для проёма. Выберите другой участок стены.');return;}
  mutate(()=>{nearest.wall.openings.push(opening);setSelection([opening.id]);},'Окно добавлено');
 }
}
function finishSlab(){if(tool!=='slab'||draft.length<3){toast('Для перекрытия нужны минимум три вершины.');return;}const points=clone(draft);draft=[];hover=null;mutate(()=>{if(polygonArea(points)<.1)throw new Error('Слишком маленькая площадь контура.');for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){if(j===i+1||(i===0&&j===points.length-1))continue;const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)throw new Error('Контур перекрытия пересекает сам себя.');}const id=uid('ПЛ');floor().slabs.push({id,kind:'slab',name:'Перекрытие',points,thickness:.2,material:'Бетон'});setSelection([id]);},'Перекрытие добавлено');}
function removeSelected(){
 if(!selectedIds.size)return;
 const item=selected();
 if(item?.host&&item.element.kind==='door'){changeDoor(item.element.id,false);return;}
 mutate(()=>{
  const current=floor(),remaining=[];
  for(const wall of current.walls){
   if(selectedIds.has(wall.id))continue;
   wall.openings=wall.openings.filter(o=>{
    if(!selectedIds.has(o.id))return true;
    if(!setOpeningDoor(o,false))return false;
    remaining.push(o.id);return true;
   });
  }
  for(const key of ['walls','slabs','furniture','rooms','dimensions'])current[key]=current[key].filter(e=>!selectedIds.has(e.id));
  setSelection(remaining);
 },'Удаление выполнено · Ctrl+Z — отменить');
}
function copySelected(){
 if(!selectedIds.size)return;
 mutate(()=>{
  const current=floor(),copies=[];
  for(const id of selectedIds){
   const item=findElement(current,id);
   if(!item||selectedIds.has(item.host?.id))continue;
   const copy=clone(item.element);copy.id=uid(copy.kind);
   if(item.host){
    copy.position+=copy.width+.2;
    if(!canPlaceOpening(item.host,copy))throw new Error('На стене недостаточно места для копии.');
    item.host.openings.push(copy);
   }else{
    if(copy.kind==='wall')copy.openings.forEach(o=>o.id=uid(o.kind));
    current[item.collection].push(copy);
    translateElement(current,copy.id,.5,.5);
   }
   copies.push(copy.id);
  }
  setSelection(copies);
 },'Копии созданы');
}
function elementIcon(e){return e.mode==='angle'?'angle':({wall:'wall',slab:'layers',doorway:'doorway',door:'door',window:'window',furniture:'cube',room:'home',dimension:'dimension'}[e.kind]||'cube');}
function renderElementList(){const list=$('elements-list');if(!list)return;const previousScroll=list.scrollTop;list.replaceChildren();const all=listElements(floor());$('elements-count').textContent=all.length;for(const e of all){const button=document.createElement('button');button.className='element-list-item'+(selectedIds.has(e.id)?' active':'');button.setAttribute('aria-pressed',String(selectedIds.has(e.id)));button.dataset.elementId=e.id;button.innerHTML=`<i data-icon="${elementIcon(e)}"></i><span></span>`;button.querySelector('span').textContent=e.name;button.title=e.name+' · '+e.id;button.onclick=event=>{setTool('select');select(e.id,event.shiftKey);};list.append(button);}if(!all.length){const note=document.createElement('p');note.className='empty-elements';note.textContent='Пока нет элементов. Начните со стены.';list.append(note);}hydrateIcons(list);list.scrollTop=previousScroll;}
function beginElementDrag(id,point,handle=null){
 if(!findElement(floor(),id))return;
 if(!selectedIds.has(id))select(id);
 else editorFeedback={};
 const ids=[...selectedIds];
 const options=sceneOptions();
 movement={before:snapshot(),id,ids,handle,start:{x:point.x,y:point.y},valid:null,
  targets:snapTargets(floor(),ids,preferences.axes,options),anchors:selectionAnchors(floor(),ids)};
}
function selectionAnchors(current,ids){
 return ids.flatMap(id=>{const item=findElement(current,id);return item?elementAnchors(item.element,item.host):[];});
}
function accurateFeedback(feedback,points){
 if(!feedback.label)return feedback;
 const hit=feedback.marker&&points.some(p=>length(sub(p,feedback.marker))<1e-6);
 const proposed=feedback.guides||[];
 const guides=proposed.filter(g=>{
  if(g.component)return points.some(p=>Math.abs(p[g.component]-g.a[g.component])<1e-6);
  if(!g.axis&&!g.face)return !!hit;
  const d=sub(g.b,g.a),l=length(d);
  return l>0&&points.some(p=>Math.abs((p.x-g.a.x)*d.y-(p.y-g.a.y)*d.x)/l<1e-6);
 });
 const label=guides.length?'Выравнивание':'';
 return {...feedback,guides,marker:hit?feedback.marker:null,
  label:hit||label&&guides.length===proposed.length?feedback.label:label};
}
function previewElementDrag(point,shift=false,disableSnap=false,unit=pixelUnit()){
 if(!movement)return;const drag=movement,sourceFloor=drag.before.project.floors.find(f=>f.id===floorId),original=findElement(sourceFloor,drag.id),candidate=clone(drag.before.project),candidateFloor=candidate.floors.find(f=>f.id===floorId),tol=unit*8;
 let dx=point.x-drag.start.x,dy=point.y-drag.start.y,feedback={},description='';
 if(Math.hypot(dx,dy)<.0001&&!drag.valid)return;
 try{
  if(drag.handle==='rotate'){
   const center=elementFrame(original.element,original.host).center,initial=Math.atan2(drag.start.y-center.y,drag.start.x-center.x),current=Math.atan2(point.y-center.y,point.x-center.x),angle=elementAngle(original.element),raw=angle+(current-initial)*180/Math.PI;
   let target=raw;if(shift)target=Math.round(raw/15)*15;else if(preferences.snap&&!disableSnap&&Math.abs(raw-Math.round(raw/45)*45)<3)target=Math.round(raw/45)*45;
   rotateElement(candidateFloor,drag.id,normalAngle(target-angle));description='Поворот · '+fmt(normalAngle(target),1)+'°';feedback={guides:[{a:center,b:point,axis:true}]};
  }else if(drag.handle){
   let target={x:point.x,y:point.y};if(preferences.snap&&!disableSnap){feedback=snapPoint(target,drag.targets,tol,{alignment:preferences.guides,axes:preferences.axes});target=feedback.label?feedback.point:{x:Math.round(target.x*20)/20,y:Math.round(target.y*20)/20};}
   resizeElement(candidateFloor,drag.id,drag.handle,target);description='Изменение размера';
   const actual=findElement(candidateFloor,drag.id),handle=transformHandles(actual.element,actual.host,pixelUnit()).find(h=>h.key===drag.handle);if(handle)feedback=accurateFeedback(feedback,[handle]);
  }else{
   if(shift){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
   if(preferences.snap&&!disableSnap){
    const wallSnap=original.element.kind==='wall'&&preferences.guides&&!shift
     ?snapWallTranslation(original.element,sourceFloor.walls.filter(w=>!drag.ids.includes(w.id)),dx,dy,tol):null;
    if(wallSnap?.guides.length===2)feedback=wallSnap;
    else{
     const generic=snapTranslation(sourceFloor,drag.ids,dx,dy,tol,{alignment:preferences.guides,axes:preferences.axes,targets:drag.targets,anchors:drag.anchors});
     feedback=generic.marker?generic:wallSnap??generic;
    }
    if(feedback.label){dx=feedback.dx;dy=feedback.dy;}else{dx=Math.round(dx*20)/20;dy=Math.round(dy*20)/20;}
   }
   if(shift){if(Math.abs(point.x-drag.start.x)>Math.abs(point.y-drag.start.y))dy=0;else dx=0;}
   translateSelection(candidateFloor,drag.ids,dx,dy);description=`Перемещение · ΔX ${fmt(dx*1000)} · ΔY ${fmt(dy*1000)} мм`;
   feedback=accurateFeedback(feedback,selectionAnchors(candidateFloor,drag.ids));
  }
  validateProject(candidate);project=candidate;drag.valid=candidate;editorFeedback=feedback;renderPlanView();refreshScene();$('tool-status').textContent=description+(feedback.label?' · '+feedback.label:'');
 }catch(error){$('tool-status').textContent='Ограничение геометрии: '+error.message;}
}
function finishElementDrag(){if(!movement)return;const drag=movement;movement=null;editorFeedback={};surface.classList.remove('moving-element');if(drag.valid&&JSON.stringify(drag.valid)!==JSON.stringify(drag.before.project)){history.push(drag.before);if(history.length>60)history.shift();future=[];project.updatedAt=new Date().toISOString();save();}render();$('tool-status').textContent='Выбор · ручки размера · круглая ручка поворота';}
function cancelElementDrag(){if(!movement)return;project=clone(movement.before.project);movement=null;editorFeedback={};surface.classList.remove('moving-element');render();$('tool-status').textContent='Изменение отменено';}

function nudgeSelected(dx,dy){if(selectedIds.size)mutate(()=>translateSelection(floor(),selectedIds,dx,dy));}
function openWorkspaceProject(next){if(!save())return;try{const catalog=saveProjects(localStorage,projects,next);projects=catalog;project=clone(next);}catch{toast('Не удалось сохранить новый проект. Скачайте текущий проект и освободите место.');return;}floorId=project.floors[0].id;setSelection([]);history=[];future=[];draft=[];section=false;setTool('select');fitPlan();render();scene?.reset();$('modal').close();}
function showNewProject(){modal('Создать проект','<p>Откроется пустой проект с одним этажом. Текущий проект останется в списке «Мои проекты».</p><label for="new-project-name">Название проекта</label><input type="text" id="new-project-name" maxlength="100" value="Новый проект"><div class="modal-actions"><button class="button" id="cancel-new-project">Отмена</button><button class="button primary" id="create-project-confirm">Создать проект</button></div>');const submit=()=>{const name=$('new-project-name').value.trim();if(name)openWorkspaceProject(createEmptyProject(name));};$('create-project-confirm').onclick=submit;$('cancel-new-project').onclick=()=>$('modal').close();$('new-project-name').onkeydown=e=>{if(e.key==='Enter')submit();};$('new-project-name').select();}
function showProjects(){if(!save())return;modal('Мои проекты','<p>Проекты на этом устройстве</p><div id="project-catalog" class="project-catalog"></div><div class="modal-actions"><button class="button primary" id="catalog-new-project"><i data-icon="plus"></i>Новый проект</button></div>');for(const p of [...projects].reverse()){const button=document.createElement('button');button.className='catalog-project'+(p.id===project.id?' active':'');button.innerHTML='<i data-icon="folder"></i><span><strong></strong><small></small></span><i data-icon="chevron"></i>';button.querySelector('strong').textContent=p.name;button.querySelector('small').textContent=p.floors.length+' эт. · '+new Date(p.updatedAt).toLocaleDateString('ru-RU')+(p.id===project.id?' · открыт':'');button.onclick=()=>openWorkspaceProject(p);$('project-catalog').append(button);}$('catalog-new-project').onclick=showNewProject;hydrateIcons($('modal-content'));}
function undo(){if(!history.length)return;future.push(snapshot());restore(history.pop());}
function redo(){if(!future.length)return;history.push(snapshot());restore(future.pop());}
function applyPreferenceButtons(){for(const [id,key] of [['grid-button','grid'],['labels-button','labels'],['dimensions-button','dimensions'],['snap-button','snap'],['guides-button','guides']]){$(id).classList.toggle('active',preferences[key]);$(id).setAttribute('aria-pressed',String(preferences[key]));} $('axes-button').classList.toggle('active',preferences.axes);syncAxisOptions();}
function togglePreference(key){preferences[key]=!preferences[key];savePreferences();render();}
function closeMenus(){
 $('editor-menu').hidden=true;
 for(const [panel,button] of [['export-menu','export-button'],['project-menu','project-menu-button'],['axes-menu','axes-button']]){
  $(panel).hidden=true;
  $(button).setAttribute('aria-expanded','false');
 }
}
function menu(id,buttonId){const wasHidden=$(id).hidden;closeMenus();$(id).hidden=!wasHidden;$(buttonId).setAttribute('aria-expanded',String(wasHidden));}
let editorMenuOrigin;
function showEditorMenu(event,id,point){
 closeMenus();
 const panel=$('editor-menu');
 editorMenuOrigin=event.target.closest('#plan-svg,canvas,button')||document.activeElement;
 if(id&&!selectedIds.has(id))select(id);
 const item=id?selected():null,kind=item?.element.kind;
 panel.replaceChildren();
 const add=(name,icon,action,disabled=false)=>{
  const button=document.createElement('button'),symbol=document.createElement('i');
  symbol.dataset.icon=icon;button.type='button';button.setAttribute('role','menuitem');
  button.append(symbol,name);button.disabled=disabled;button.tabIndex=-1;
  button.addEventListener('click',()=>{closeMenus();action();});
  panel.append(button);
 };
 const separator=()=>{
  const rule=document.createElement('div');rule.className='menu-separator';rule.setAttribute('role','separator');panel.append(rule);
 };
 if(id){
  if(kind==='wall'&&point)add('Создать дверной проём','doorway',()=>addDoorway(item.element,projectPoint(point,item.element).distance));
  if(kind==='doorway')add('Вставить дверь','door',()=>changeDoor(item.element.id,true));
  if(item&&$('inspector-content').offsetWidth)add('Свойства','edit',()=>$('inspector-content').querySelector('[data-property]')?.focus());
  add('Дублировать','copy',copySelected);
  if(kind==='door')add('Вынуть дверь','doorway',()=>changeDoor(item.element.id,false));
  else add(kind==='doorway'?'Удалить проём':'Удалить','trash',removeSelected);
 }else{
  add('Отменить','undo',undo,!history.length);
  add('Повторить','redo',redo,!future.length);
  add('Вписать модель','fit',()=>{fitPlan();scene?.reset();});
 }
 separator();
 add(preferences.textures?'Отключить текстуры':'Включить текстуры','palette',()=>togglePreference('textures'));
 hydrateIcons(panel);
 panel.hidden=false;
 const {width,height}=panel.getBoundingClientRect();
 panel.style.left=Math.max(8,Math.min(event.clientX+3,window.innerWidth-width-8))+'px';
 panel.style.top=Math.max(8,Math.min(event.clientY+3,window.innerHeight-height-8))+'px';
 panel.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
$('editor-menu').addEventListener('keydown',event=>{
 event.stopPropagation();
 if(event.key==='Escape'||event.key==='Tab'){
  if(event.key==='Escape')event.preventDefault();
  closeMenus();editorMenuOrigin?.focus({preventScroll:true});return;
 }
 if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
 event.preventDefault();
 const items=[...$('editor-menu').querySelectorAll('button:not(:disabled)')],index=items.indexOf(document.activeElement);
 const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?-1:1)+items.length)%items.length;
 items[next]?.focus();
});
$('editor-menu').addEventListener('contextmenu',event=>event.preventDefault());
document.addEventListener('pointerdown',event=>{
 if(!$('editor-menu').hidden&&!event.target.closest('#editor-menu'))closeMenus();
});
window.addEventListener('resize',closeMenus);
function modal(title,content){closeMenus();$('modal-title').textContent=title;$('modal-content').innerHTML=content;hydrateIcons($('modal-content'));$('modal').showModal();}
function editFloor(level){
 if(!level&&project.floors.length>=20){toast('В проекте может быть до 20 этажей.');return;}
 const top=floorsByElevation()[0];
 const initial=level||{name:`${project.floors.length+1} этаж`,elevation:Math.min(200,top.elevation+top.height),height:top.height};
 modal(level?'Настроить этаж':'Добавить этаж',`<form id="floor-form" class="floor-form">
  <label for="floor-name">Название</label><input id="floor-name" type="text" maxlength="100" required value="${escapeHTML(initial.name)}">
  <label for="floor-level">Отметка пола, м</label><input id="floor-level" type="number" required min="-100" max="200" step="any" value="${initial.elevation}">
  <label for="floor-height">Высота этажа, м</label><input id="floor-height" type="number" required min="1" max="15" step="any" value="${initial.height}">
  <div class="modal-actions"><button class="button" id="cancel-floor" type="button">Отмена</button><button class="button primary" type="submit">${level?'Сохранить':'Создать этаж'}</button></div>
 </form>`);
 $('cancel-floor').onclick=()=>$('modal').close();
 $('floor-form').onsubmit=event=>{
  event.preventDefault();
  const name=$('floor-name').value.trim();
  if(!name){$('floor-name').focus();return;}
  const settings={name,elevation:$('floor-level').valueAsNumber,height:$('floor-height').valueAsNumber};
  const ok=mutate(()=>{
   if(level)Object.assign(floor(),settings);
   else{
    const id=uid('floor');
    project.floors.push({id,...settings,walls:[],slabs:[],furniture:[],rooms:[],dimensions:[]});
    floorId=id;setSelection([]);draft=[];hover=null;editorFeedback={};section=false;
   }
  },level?'Параметры этажа сохранены':'Этаж создан');
  if(ok){$('modal').close();if(!level)fitPlan();}
 };
 $('floor-name').select();
}
function actionModal(title,description,label,callback){modal(title,`<p>${description}</p><div class="modal-actions"><button class="button" id="cancel-action">Отмена</button><button class="button primary" id="confirm-action">${label}</button></div>`);$('cancel-action').onclick=()=>$('modal').close();$('confirm-action').onclick=()=>{$('modal').close();callback();};}
function exportProject(format){closeMenus();if(format==='print'){printPlan();return;}let data,type,extension;if(format==='json'){data=JSON.stringify(project,null,2);type='application/json';extension='json';}else{data=exportSVG(floor(),{labels:preferences.labels,dimensions:preferences.dimensions,textures:preferences.textures,axes:preferences.axes,feedback:editorFeedback});type='image/svg+xml';extension='svg';}const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=project.name.replace(/[<>:"/\\|?*]/g,'-')+(format==='svg'?' — '+floor().name:'')+'.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast(format==='json'?'Проект скачан. Его можно открыть на другом устройстве.':'Векторный план SVG скачан.');}
function printPlan(){const sheet=$('print-sheet');sheet.replaceChildren();const title=document.createElement('h1');title.textContent=project.name+' · '+floor().name;sheet.append(title);const drawing=document.createElement('div');drawing.innerHTML=exportSVG(floor(),{labels:true,dimensions:true,textures:preferences.textures});sheet.append(drawing);const note=document.createElement('p');note.textContent='Схема из прототипа редактора · '+new Date().toLocaleDateString('ru-RU')+' · Масштаб зависит от настроек печати. Не является рабочей документацией.';sheet.append(note);window.print();}

function syncAxisOptions(){
 for(const input of $('axes-menu').querySelectorAll('input')){
  const kind=input.dataset.axisKind;
  input.checked=kind?preferences.axisTypes[kind]!==false:preferences.axes;
 }
}
function setupAxisOptions(){
 const types=$('axis-type-options');
 for(const [kind,name] of Object.entries(AXIS_TYPES)){
  const label=document.createElement('label'),input=document.createElement('input');
  input.type='checkbox';
  input.dataset.axisKind=kind;
  label.append(input,name);
  types.append(label);
 }
 $('axes-button').onclick=()=>{
  menu('axes-menu','axes-button');
  if(!$('axes-menu').hidden)$('axes-menu').querySelector('input').focus();
 };
 $('axes-menu').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.stopPropagation();closeMenus();$('axes-button').focus();}
 });
 $('axes-menu').addEventListener('change',event=>{
  const input=event.target,kind=input.dataset.axisKind;
  if(kind)preferences.axisTypes[kind]=input.checked;
  else preferences.axes=input.checked;
  editorFeedback={};
  savePreferences();render();
 });
}

function setupFurnitureLibrary(){const root=document.createElement('div');root.className='library-grid furniture-library';for(const type of ['sofa','table','chair','desk','bed','plant','stairs','cabinet','basin','toilet']){const button=document.createElement('button');button.innerHTML='<i data-icon="cube"></i><strong></strong>';button.querySelector('strong').textContent=FURNITURE_TYPES[type];button.onclick=()=>{mutate(()=>{const e=makeFurniture(type,Math.round((camera.x+camera.w/2)*20)/20,Math.round((camera.y+camera.h/2)*20)/20,uid('МБ'));floor().furniture.push(e);setSelection([e.id]);},'Элемент добавлен. Перетащите его на нужное место.');setTool('select');};root.append(button);}$('library-panel').append(root);}
setupFurnitureLibrary();setupAxisOptions();hydrateIcons();render();fitPlan();
$$('[data-tool]').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.tool)));
$$('[data-library]').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.library)));
$$('[data-view]').forEach(button=>button.addEventListener('click',()=>{section=false;setView(button.dataset.view);refreshScene();}));
$$('[data-sidebar]').forEach(button=>button.addEventListener('click',()=>{$$('[data-sidebar]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-selected',String(b===button));});$('project-panel').hidden=button.dataset.sidebar!=='project';$('library-panel').hidden=button.dataset.sidebar!=='library';}));
$$('[data-collapse]').forEach(button=>button.addEventListener('click',()=>{const content=$(button.dataset.collapse);content.hidden=!content.hidden;button.setAttribute('aria-expanded',String(!content.hidden));button.querySelector('i').classList.toggle('rotated',content.hidden);}));
$('undo').onclick=undo;$('redo').onclick=redo;$('copy-button').onclick=copySelected;$('delete-button').onclick=removeSelected;$('deselect-button').onclick=()=>select(null);
$('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);$('zoom-fit').onclick=fitPlan;$('scale-button').onclick=fitPlan;$('focus-button').onclick=()=>{fitPlan();scene?.reset();};$('reset-camera').onclick=()=>scene?.reset();
for(const [id,key] of [['grid-button','grid'],['labels-button','labels'],['dimensions-button','dimensions'],['snap-button','snap'],['guides-button','guides']])$(id).onclick=()=>togglePreference(key);
$('sidebar-toggle').onclick=()=>{document.querySelector('.app-shell').classList.toggle('sidebar-hidden');scene?.resize();};
$('export-button').onclick=()=>menu('export-menu','export-button');$('project-menu-button').onclick=()=>menu('project-menu','project-menu-button');$$('[data-export]').forEach(button=>button.onclick=()=>exportProject(button.dataset.export));
$('new-project').onclick=showNewProject;$('my-projects').onclick=showProjects;
document.addEventListener('click',event=>{if(!event.target.closest('.dropdown')&&!event.target.closest('#export-button')&&!event.target.closest('#project-menu-button')&&!event.target.closest('.axes-control'))closeMenus();});
$('import-button').onclick=()=>$('import-file').click();
$('import-file').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;if(file.size>8*1024*1024){toast('Максимальный размер проекта — 8 МБ.');return;}try{const imported=validateProject(JSON.parse(await file.text()));actionModal('Открыть проект?',`Текущий проект будет заменён. Изменение можно отменить через Ctrl+Z. Скачайте текущий проект, если хотите сохранить отдельную копию.`,'Открыть',()=>{mutate(()=>{project=clone(imported);floorId=project.floors[0].id;setSelection([]);},'Проект открыт');fitPlan();});}catch(error){toast(error instanceof SyntaxError?'Не удалось прочитать JSON-файл.':error.message);}};
$('rename-project').onclick=()=>{modal('Название проекта','<p>Название можно изменить в любой момент.</p><label for="project-name-input">Проект</label><input type="text" id="project-name-input" maxlength="100"><div class="modal-actions"><button class="button primary" id="save-project-name">Сохранить</button></div>');$('project-name-input').value=project.name;$('project-name-input').focus();const submit=()=>{const name=$('project-name-input').value.trim();if(!name)return;mutate(()=>project.name=name);$('modal').close();};$('save-project-name').onclick=submit;$('project-name-input').onkeydown=e=>{if(e.key==='Enter')submit();};};
$('reset-project').onclick=()=>actionModal('Восстановить пример?','Откроется исходный дом с двумя этажами. Текущую модель можно вернуть через Ctrl+Z.','Восстановить',()=>{mutate(()=>{project=createDemo();floorId=project.floors[0].id;setSelection(['СТ-014']);});fitPlan();});
$('theme-button').onclick=()=>{closeMenus();togglePreference('dark');};
$('add-floor').onclick=()=>editFloor();
$('edit-floor').onclick=()=>editFloor(floor());
$('working-floor').onchange=event=>chooseFloor(event.target.value);
$('show-all-floors').onchange=event=>{
 preferences.allFloors=event.target.checked;
 savePreferences();fitPlan();render();
};
$('section-view').onclick=()=>{section=true;setView('3d');$('model-title').textContent='3D · Отсечка';refreshScene();toast('Показана горизонтальная отсечка на высоте 1 150 мм.');};
$('facade-view').onclick=async()=>{section=false;setView('3d');await ensureScene();refreshScene();scene?.facade();$('model-title').textContent='3D · Южный фасад';};
$('sheet-view').onclick=()=>actionModal('План этажа','Откроется диалог печати браузера. Для сохранения PDF выберите соответствующий принтер. Масштаб схемы зависит от настроек печати.','Печать / PDF',printPlan);
$('modal-close').onclick=()=>$('modal').close();$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('modal').close();}});
function showAbout(){modal('Рабочее пространство','<p>Интерактивный прототип архитектурного редактора: план, 3D и свойства элементов в одном окне.</p><p>Проект сохраняется <strong>только в этом браузере</strong>. Чтобы перенести его на другое устройство, используйте «Экспорт → Проект JSON» и «Открыть».</p><p>Режим «Все этажи» показывает здание целиком. Новые элементы создаются на рабочем этаже. Все элементы можно выделять и перемещать. Проекты доступны через меню «Мои проекты». Полноценные BIM-расчёты, IFC и командная работа запланированы на следующих этапах.</p>');}
$('about-button').onclick=showAbout;
function showHelp(){modal('Быстрый старт','<p>Выберите стену на плане, измените её размеры справа и откройте 3D. Для построения стены укажите две точки.</p>'+[['Выбор / перемещение','V → перетащить'],['Выделение рамкой','Мышь / Shift + мышь'],['Добавить к выделению','Shift + щелчок'],['Изменение размера','Квадратные ручки'],['Поворот','Круглая ручка'],['Шаг поворота 15°','Shift'],['Отключить привязки','Alt'],['Точный сдвиг','Стрелки / Shift+стрелки'],['Стена','W'],['Дверной проём','G → стена → размеры'],['Вставить дверь','D → пустой проём'],['Окно','O'],['Контекстное меню','Правая кнопка / Shift+F10'],['Перекрытие','P → точки → Enter'],['Размер','M → две точки'],['Угловой размер','A → вершина → по точке на лучах'],['Помещение','R → два угла'],['Панорама плана','Пробел + перетаскивание'],['Масштаб','Колесо мыши'],['Вписать модель','F'],['Отмена / повтор','Ctrl+Z / Ctrl+Shift+Z'],['Дублировать','Ctrl+D'],['Удалить','Delete'],['Завершить инструмент','Esc']].map(([label,key])=>`<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`).join(''));}
$('help-button').onclick=showHelp;
$('settings-button').onclick=()=>{modal('Отображение',`<p>Настройки сохраняются на этом устройстве.</p>${[['dark','Тёмная тема'],['textures','Текстуры материалов'],['grid','Сетка'],['labels','Названия помещений'],['dimensions','Размеры'],['snap','Привязка к краям, серединам и центрам'],['axes','Оси деталей и привязки к осям'],['guides','Направляющие и выравнивание']].map(([key,label])=>`<label class="settings-option">${label}<input class="toggle" type="checkbox" data-pref="${key}" ${preferences[key]?'checked':''}></label>`).join('')}`);$$('[data-pref]').forEach(input=>input.onchange=()=>{preferences[input.dataset.pref]=input.checked;savePreferences();render();});};
const surface=$('drawing-surface');
new ResizeObserver(()=>renderPlanView()).observe(surface);
surface.addEventListener('contextmenu',event=>{
 event.preventDefault();
 if(event.button!==2||spaceHeld)return;
 const handle=event.target.closest('[data-handle]'),element=event.target.closest('[data-element]');
 showEditorMenu(event,handle?.dataset.owner||element?.dataset.element,worldPoint(event));
});
$('elements-list').addEventListener('contextmenu',event=>{
 const id=event.target.closest('[data-element-id]')?.dataset.elementId;
 if(!id)return;
 event.preventDefault();showEditorMenu(event,id,null);
});
function pointerPosition(event){return {x:event.clientX,y:event.clientY};}
function clearMarquee(){marquee=null;$('plan-marquee').hidden=true;scene?.cancelSelection();}
surface.addEventListener('pointerdown',event=>{
 if(event.button===1||spaceHeld){
  event.preventDefault();
  pan={x:event.clientX,y:event.clientY,camera:{...camera}};
  surface.setPointerCapture(event.pointerId);surface.classList.add('panning');return;
 }
 if(event.button!==0||!event.isPrimary)return;
 const p=worldPoint(event);
 if(tool!=='select'){choosePoint(snapped(p,event),event);return;}
 const handle=event.target.closest('[data-handle]'),element=event.target.closest('[data-element]');
 const id=handle?.dataset.owner||element?.dataset.element;
 surface.setPointerCapture(event.pointerId);
 if(handle||id&&!event.shiftKey){
  beginElementDrag(id,p,handle?.dataset.handle||null);
  if(movement){movement.pointerStart=pointerPosition(event);surface.classList.add('moving-element');}
 }else marquee={pointerStart:pointerPosition(event),worldStart:p,extend:event.shiftKey,id,active:false};
});
surface.addEventListener('pointermove',event=>{
 if(pan){const matrix=$('plan-svg').getScreenCTM();camera.x=pan.camera.x-(event.clientX-pan.x)/matrix.a;camera.y=pan.camera.y-(event.clientY-pan.y)/matrix.d;updateViewBox();return;}
 const p=worldPoint(event);
 if(marquee){
  marquee.active ||= length(sub(pointerPosition(event),marquee.pointerStart))>=4;
  if(marquee.active)showSelectionBox($('plan-marquee'),selectionBounds(marquee.pointerStart,pointerPosition(event)),surface.getBoundingClientRect());
  return;
 }
 if(movement){
  if(movement.valid||length(sub(pointerPosition(event),movement.pointerStart||pointerPosition(event)))>=4)previewElementDrag(p,event.shiftKey,event.altKey);
  return;
 }
 cursorPoint=p;updateCoordinates();
 if(draft.length||tool!=='select'){hover=snapped(p,event);renderPlanView();}
});
function updateCoordinates(){
 const coordinates=$('cursor-coordinates');
 coordinates.replaceChildren();
 for(const [axis,value] of [['X',cursorPoint.x],['Y',cursorPoint.y],['Z',floor().elevation]]){
  const span=document.createElement('span');span.textContent=axis+': '+fmt(value*1000);coordinates.append(span);
 }
}
function endPan(){pan=null;surface.classList.remove('panning');}
surface.addEventListener('pointerup',event=>{
 if(marquee){
  const {active,worldStart,extend,id}=marquee;
  clearMarquee();
  if(active)selectMany(selectInPlan(floor(),selectionBounds(worldStart,worldPoint(event)),sceneOptions()),extend);
  else if(id||!extend)select(id,extend);
 }else finishElementDrag();
 endPan();
});
surface.addEventListener('pointercancel',()=>{clearMarquee();cancelElementDrag();endPan();});
surface.addEventListener('lostpointercapture',()=>{if(marquee||movement||pan){clearMarquee();cancelElementDrag();endPan();}});
surface.addEventListener('dblclick',()=>{if(tool==='slab')finishSlab();});
surface.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,event.deltaY))*.0017),worldPoint(event));},{passive:false});
document.addEventListener('keydown',event=>{
 if(event.target.closest('input,select,textarea')||$('modal').open)return;
 if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){
  const target=event.target.closest('#plan-svg,#model-container canvas,[data-element-id]');
  if(!target)return;
  event.preventDefault();
  const {left,top,width,height}=target.getBoundingClientRect();
  showEditorMenu({target,clientX:left+width/2,clientY:top+height/2},target.dataset.elementId||singleSelection(),null);return;
 }
 const ctrl=event.ctrlKey||event.metaKey;
 const pressed=event.key.toLowerCase(),key=ctrl&&/^[а-яё]$/.test(pressed)&&event.code.startsWith('Key')?event.code.slice(3).toLowerCase():pressed;if(ctrl&&key==='z'&&(movement||marquee||scene?.cancelSelection())){event.preventDefault();clearMarquee();cancelElementDrag();return;}if(ctrl&&key==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}if(ctrl&&key==='y'){event.preventDefault();redo();return;}if(ctrl&&key==='d'){event.preventDefault();copySelected();return;}if(ctrl&&key==='s'){event.preventDefault();save();toast(saveFailed?'Скачайте проект через «Экспорт».':'Проект сохранён на устройстве.');return;}if(ctrl)return;if(event.code==='Space'){event.preventDefault();spaceHeld=true;return;}if(key==='escape'){clearMarquee();cancelElementDrag();draft=[];setTool('select');closeMenus();return;}if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)&&selectedIds.size){event.preventDefault();const step=event.shiftKey?.5:.05;nudgeSelected(key==='arrowleft'?-step:key==='arrowright'?step:0,key==='arrowup'?-step:key==='arrowdown'?step:0);return;}if(key==='enter'&&tool==='slab'){finishSlab();return;}if(['delete','backspace'].includes(key)){event.preventDefault();removeSelected();return;}if(key==='f'){fitPlan();scene?.reset();return;}if(key==='?'){showHelp();return;}const mapping={v:'select',w:'wall',g:'doorway',d:'door',o:'window',p:'slab',m:'dimension',a:'angle',r:'room'};if(mapping[key]){event.preventDefault();setTool(mapping[key]);}});
document.addEventListener('keyup',event=>{if(event.code==='Space')spaceHeld=false;});window.addEventListener('blur',()=>{spaceHeld=false;clearMarquee();cancelElementDrag();endPan();});
window.addEventListener('storage',event=>{if([STORAGE_KEY,CATALOG_KEY].includes(event.key)&&event.newValue)toast('Проект изменён в другой вкладке. Скачайте текущую копию перед перезагрузкой.');});
if(loadWarning)toast(loadWarning);
