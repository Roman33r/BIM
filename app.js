import {createDemo,createEmptyProject,clone,wallLength,uid,projectPoint,canPlaceOpening,polygonArea,validateProject} from './model.js';
import {renderPlan,exportSVG,planBounds} from './plan.js';
import {hydrateIcons} from './icons.js';
import {findElement,listElements,elementPosition,translateElement,translateSelection,makeFurniture,setOpeningDoor,moveSelectionToFloor,FLOOR_COLLECTIONS,FURNITURE_TYPES} from './elements.js';
import {loadProjects,saveProjects,CATALOG_KEY,LEGACY_KEY} from './project-store.js';
import {elementFrame,elementAngle,elementAnchors,transformHandles,resizeElement,rotateElement,setElementAngle,normalAngle,length,sub,isSimplePolygon} from './transforms.js';
import {snapTargets,snapPoint,snapTranslation,snapWallTranslation} from './snapping.js';
import {AXIS_TYPES,extendSelection,selectInPlan,selectionBounds,showSelectionBox} from './selection.js';
import {angleLabel,angleRadius,angleValue,linearDimensionOffset} from './annotations.js';
import {materialNames} from './materials.js';
import {STRUCTURE_TYPES,isStructure,isRoundStructure,isPileCap,linkedPileSelection,makeStructure,pileCapFor} from './structures.js';
import {endpointAtLength,rulerTicks,segmentMeasurement} from './measurements.js';
import {canTiltElement,setElementTilt,tiltFields} from './spatial.js';
import {GUIDE_STYLES} from './construction-guides.js';
import {pileAreaPoints} from './pile-layout.js';
import {snapToGrid,validGridStep} from './grid.js';
import {isFastener,isRingFastener,capHoles,capHoleSettings} from './hardware.js';

const $=id=>document.getElementById(id),$$=selector=>[...document.querySelectorAll(selector)];
const STORAGE_KEY=LEGACY_KEY,PREFS_KEY='bim-workspace-preferences-v1';
const fmt=(value,digits=0)=>Number(value).toLocaleString('ru-RU',{maximumFractionDigits:digits});
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let project=createDemo(),projects=[],loadWarning='',preferences={dark:false,grid:true,gridSnap:false,gridStep:.25,labels:true,dimensions:true,snap:true,axes:true,guides:true,allFloors:false,textures:true,rulers:true,axisTypes:{}};
try{({project,projects}=loadProjects(localStorage));const prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}');for(const k of Object.keys(preferences))if(typeof prefs[k]==='boolean'&&k!=='axisTypes')preferences[k]=prefs[k];if(validGridStep(prefs.gridStep))preferences.gridStep=prefs.gridStep;for(const kind of Object.keys(AXIS_TYPES))if(prefs.axisTypes?.[kind]===false)preferences.axisTypes[kind]=false;}catch{loadWarning='Не удалось прочитать локальное сохранение. Открыт пример; исходное сохранение не изменено.';}
let floorId=project.floors[0].id,tool='select',view='plan',draft=[],hover=null,pan=null,spaceHeld=false,section=false,scene=null,scenePromise=null;
let structureType='pile';
let constructionType='dashed';
let pileArea=null,pileAreaType='screwPile',pileSpacing=1.5;
let measuredLine=null;
let numericDirection=null;
let inspectorTab='geometry';
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
function updateViewBox(){$('plan-svg').setAttribute('viewBox',`${camera.x} ${camera.y} ${camera.w} ${camera.h}`);$('zoom-value').textContent=fmt(baseCamera.w/camera.w*100)+'%';renderRulers();}
function renderRulers(){
 const matrix=$('plan-svg').getScreenCTM(),visible=preferences.rulers&&matrix?.a>0&&$('drawing-surface').clientWidth>0;
 for(const id of ['plan-ruler-x','plan-ruler-y','plan-ruler-unit'])$(id).hidden=!visible;
 if(!visible)return;
 for(const axis of ['x','y']){
  const horizontal=axis==='x',node=$('plan-ruler-'+axis),bounds=node.getBoundingClientRect();
  const zero=horizontal?matrix.e-bounds.left:matrix.f-bounds.top,size=horizontal?bounds.width:bounds.height;
  const layout=`${zero}/${size}/${matrix.a}`;
  if(node.dataset.layout===layout)continue;
  node.dataset.layout=layout;
  const ticks=rulerTicks(-zero/matrix.a,(size-zero)/matrix.a,matrix.a);
  let svg='';
  for(const tick of ticks){
   const p=Math.round(zero+tick.value*matrix.a)+.5,mark=tick.major?7:4;
   const line=horizontal?`M${p} 22v-${mark}`:`M24 ${p}h-${mark}`;
   svg+=`<path d="${line}" stroke="currentColor" opacity=".55"/>`;
   if(tick.major)svg+=horizontal
    ?`<text x="${p+3}" y="11">${fmt(tick.value*1000)}</text>`
    :`<text x="11" y="${p+1}" text-anchor="middle" transform="rotate(-90 11 ${p+1})">${fmt(tick.value*1000)}</text>`;
  }
  node.innerHTML=`<svg fill="currentColor" width="${bounds.width}" height="${bounds.height}">${svg}</svg>`;
 }
}
function zoom(factor,center){
 const next=Math.max(.25,Math.min(Math.max(100,baseCamera.w*6),camera.w*factor));
 if(camera.w===next)return;
 const scale=next/camera.w,anchor=center||{x:camera.x+camera.w/2,y:camera.y+camera.h/2};
 camera.x=anchor.x+(camera.x-anchor.x)*scale;camera.y=anchor.y+(camera.y-anchor.y)*scale;
 camera.w=next;camera.h*=scale;renderPlanView();
}
function pixelUnit(){return 1/($('plan-svg').getScreenCTM()?.a||50);}
function renderPlanView(){
 updateViewBox();
 const start=drawingStart();
 if(start&&!numericDirection)numericDirection={x:start.x+1,y:start.y};
 const effectiveHover=start&&drawLengthValue()!==null?endpointAtLength(start,hover||numericDirection,drawLengthValue()):hover;
 const points=draft.length?[...draft,...(effectiveHover?[effectiveHover]:[])]:[];
 let structurePreview;
 if(tool==='structure'&&effectiveHover){
  const shape=STRUCTURE_TYPES[structureType].shape;
  if(shape==='round'||shape==='rect'||shape==='fastener')structurePreview=makeStructure(structureType,'',[shape==='fastener'&&preferences.snap?nearestCapHole(effectiveHover)?.point||effectiveHover:effectiveHover]);
  else if(shape==='line'&&points.length===2)structurePreview=makeStructure(structureType,'',points);
 }
 const measurement=tool==='measure'
  ?(draft.length&&effectiveHover?{a:draft[0],b:effectiveHover}:measuredLine?.floorId===floorId?measuredLine:null):null;
 const drawMeasurement=start&&effectiveHover&&tool!=='measure'?{a:start,b:effectiveHover}:null;
 const dimensionDraft=tool==='dimension'&&draft.length===2
  ?{a:draft[0],b:draft[1],offset:Math.max(-100,Math.min(100,linearDimensionOffset(draft[0],draft[1],hover||draft[1])))}:null;
 renderMeasurement(measurement);
 renderDrawingInput(start,drawMeasurement);
 $('plan-svg').innerHTML=renderPlan(floor(),{selectedId:singleSelection(),selectedIds,grid:preferences.grid,gridStep:preferences.gridStep,labels:preferences.labels,dimensions:preferences.dimensions||['angle','dimension'].includes(tool),dark:preferences.dark,textures:preferences.textures,interactive:tool==='select',axes:preferences.axes,axisTypes:preferences.axisTypes,unit:pixelUnit(),feedback:editorFeedback,bounds:camera,referenceFloors:otherFloors(),draft:['angle','measure'].includes(tool)||dimensionDraft?[]:points,angleDraft:tool==='angle'?points:null,structurePreview,measurement,pileArea,drawMeasurement,dimensionDraft}).content;
}
function drawingStart(){
 if(!draft.length)return null;
 if(tool==='dimension')return draft.length===1?draft[0]:null;
 if(['wall','room','slab','measure','angle'].includes(tool))return tool==='angle'?draft[0]:draft.at(-1);
 if(tool==='construction'&&constructionType!=='point')return draft[0];
 if(tool==='structure'&&['line','contour'].includes(STRUCTURE_TYPES[structureType].shape))return draft.at(-1);
 return null;
}
function drawLengthValue(){
 const value=$('draw-length').value.trim().replace(',','.');
 const parsed=Number(value)/1000;
 return value&&Number.isFinite(parsed)&&parsed>0?parsed:null;
}
function renderDrawingInput(start,measurement){
 const form=$('draw-length-form');form.hidden=!start;
 if(!start){$('draw-length').value='';numericDirection=null;return;}
 $('draw-length').placeholder=measurement?String(Math.round(segmentMeasurement(measurement.a,measurement.b).distance*1000)):'Введите длину';
}
function commitDrawingLength(){
 const start=drawingStart(),value=drawLengthValue();
 if(!start||value===null){toast('Введите длину больше нуля в миллиметрах.');return;}
 const max=tool==='wall'||tool==='structure'&&STRUCTURE_TYPES[structureType].shape==='line'?100:2000;
 if(value>max){toast('Максимальная длина — '+fmt(max*1000)+' мм.');return;}
 const endpoint=endpointAtLength(start,numericDirection||{x:start.x+1,y:start.y},value);
 $('draw-length').value='';numericDirection=null;hover=null;editorFeedback={};
 choosePoint(endpoint,{target:$('plan-svg'),detail:1,altKey:true});
 renderPlanView();
}
function renderMeasurement(measurement){
 const panel=$('measure-result');
 panel.hidden=!measurement;
 if(!measurement)return;
 panel.setAttribute('aria-live',measurement===measuredLine?'polite':'off');
 const {distance,dx,dy,angle}=segmentMeasurement(measurement.a,measurement.b);
 const summary=`<strong>${fmt(distance*1000)} мм</strong><span>ΔX ${fmt(dx*1000)} мм</span><span>ΔY ${fmt(dy*1000)} мм</span><span>${fmt(angle,1)}°</span>`;
 if(panel.innerHTML!==summary)panel.innerHTML=summary;
}

const floorsByElevation=()=>[...project.floors].sort((a,b)=>b.elevation-a.elevation);
const floorLabel=f=>`${f.name} · ${elevation(f.elevation)} м`;
function floorOptions(){
 return floorsByElevation().map(f=>`<option value="${escapeHTML(f.id)}" ${f.id===floorId?'selected':''}>${escapeHTML(floorLabel(f))}</option>`).join('');
}
function chooseFloor(id){
 if(id===floorId||!project.floors.some(level=>level.id===id))return;
 floorId=id;setSelection([]);draft=[];hover=null;pileArea=null;measuredLine=null;editorFeedback={};section=false;
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
function sectionTitle(title){return `<h2 class="section-heading">${title}</h2>`;}
function structureProperties(e){
 if(isFastener(e)){
  const ring=isRingFastener(e),nutFactor=e.type==='nut'?Math.cos(Math.PI/6):1,inputs=[['diameter',ring?'Диаметр отверстия':'Диаметр стержня',e.diameter,1,Math.floor((e.headDiameter-.001)*nutFactor*1000)],['height',ring?'Толщина':'Длина стержня',e.height,Math.max(.5,(e.threadPitch||0)*2000),2000],['headDiameter',ring?'Наружный габарит':'Габарит головки',e.headDiameter,Math.ceil(e.diameter/nutFactor*1000)+1,400]];
  if(e.headHeight!==undefined)inputs.push(['headHeight','Высота головки',e.headHeight,.5,100]);
  if(e.threadPitch!==undefined)inputs.push(['threadPitch','Шаг резьбы',e.threadPitch,.5,Math.min(20,e.height*500)]);
  return inputs.map(([key,label,value,min,max])=>propertyInput(key,label,Number((value*1000).toFixed(2)),{min,max,step:.01})).join('')+'<p class="property-note">Стержень направлен вниз от отметки установки. Поворот и наклоны доступны во вкладке «Положение».</p>';
 }
 const dimensions=[],shape=STRUCTURE_TYPES[e.type].shape;
 const screw=e.type==='screwPile';
 if(shape==='line')dimensions.push(['length','Длина',wallLength(e),50,100000],['thickness',e.type==='rim'?'Ширина пакета':'Ширина сечения',e.thickness,20,10000]);
 if(shape==='round')dimensions.push(['diameter',screw?'Диаметр ствола':'Диаметр',e.diameter,50,screw?Math.floor(e.bladeDiameter*1000+1e-7)-10:10000]);
 if(screw)dimensions.push(
  ['bladeDiameter','Диаметр лопасти',e.bladeDiameter,Math.ceil(e.diameter*1000-1e-7)+10,10000],
  ['bladePitch','Шаг витка',e.bladePitch,10,Math.floor((e.height*.7-e.bladeThickness)*1000+1e-7)],
  ['bladeThickness','Толщина лопасти',e.bladeThickness,2,Math.min(60,Math.floor((e.height*.7-e.bladePitch)*1000+1e-7))]);
 if(shape==='rect')dimensions.push(['w','Ширина',e.w,50,30000],['d','Длина в плане',e.d,50,30000]);
 const heightLabel=e.kind==='framing'?'Высота сечения':shape==='round'?'Длина сваи':shape==='contour'?'Толщина плиты':isPileCap(e)?'Толщина пластины':'Высота';
 dimensions.push(['height',heightLabel,e.height,screw?Math.ceil((e.bladePitch+e.bladeThickness)*1000/.7):isPileCap(e)?5:20,30000]);
 if(e.gauge!==undefined)dimensions.push(['gauge','Толщина профиля',e.gauge,1,Math.floor(1000*Math.min(.9*e.thickness,.45*e.height))]);
 const holes=isPileCap(e)?capHoleSettings(e):null;
 const holeFields=holes?sectionTitle('Крепёжные отверстия')+`<div class="property-row"><label for="property-holeCount">Количество</label><select id="property-holeCount" data-property="holeCount">${[0,2,4,8].map(count=>`<option value="${count}" ${holes.count===count?'selected':''}>${count||'Без отверстий'}</option>`).join('')}</select></div>`
  +propertyInput('holeDiameter','Диаметр отверстия',Number((holes.diameter*1000).toFixed(2)),{min:3,max:60,step:.1})
  +propertyInput('holeInset','От края до центра',Number((holes.inset*1000).toFixed(2)),{min:0,max:15000,step:.1})+'<p class="property-note">Сквозные отверстия. Их центры доступны для привязки деталей.</p>':'';
 return dimensions.map(([key,label,value,min,max])=>propertyInput(key,label,Math.round(1000*value),{min,max,step:1})).join('')+holeFields
  +(e.type==='rim'?`<p class="property-note">Пакет из 3 досок ${fmt(e.height*1000)} × ${fmt(e.thickness*1000/3)} мм. На прямых углах торцы досок соединяются вразбежку.</p>`:'');
}
function positionProperties(e,host){
 if(host)return propertyInput('position','От начала стены',Math.round(e.position*1000),{min:0,max:100000,step:1})
  +'<p class="property-note">Проём перемещается вдоль стены. Наклон задаётся в свойствах стены.</p>';
 const pos=elementPosition(e),rotatable=!isRoundStructure(e)&&!(e.kind==='guide'&&e.type==='point'),tiltable=canTiltElement(e);
 const reference=e.mode==='angle'?'Вершина угла':e.a?'Начало элемента':e.points?'Центр по вершинам контура'
  :e.kind==='guide'?'Опорная точка':isRoundStructure(e)||isPileCap(e)||isFastener(e)?'Центр элемента':'Начальный угол элемента';
 let fields=`<p class="property-note position-reference">${reference}</p>`;
 fields+=propertyInput('x','Координата X',Math.round(pos.x*1000),{min:-1000000,max:1000000,step:1})
  +propertyInput('y','Координата Y',Math.round(pos.y*1000),{min:-1000000,max:1000000,step:1});
 if(isStructure(e)){
  if(isPileCap(e)&&e.pileId!==undefined){
   fields+=`<div class="property-row"><span class="field-label">Верх от отметки этажа</span><strong>${fmt(e.elevation*1000)} мм</strong></div><p class="property-note">Оголовок следует за сваей. Углы X и Y задают его дополнительный наклон.</p>`;
  }else fields+=propertyInput('elevation',isFastener(e)?'Отметка установки':'Верх от отметки этажа',Math.round(e.elevation*1000),{min:-100000,max:isPileCap(e)?130000:100000,step:1});
 }
 if(rotatable||tiltable)fields+=sectionTitle('Поворот');
 const degrees={min:-360,max:360,step:.1,unit:'°'};
 if(rotatable){
  const angle=(elementAngle(e)+360)%360;
  fields+=propertyInput('angle','Вокруг Z',Number(angle.toFixed(2))%360,degrees);
  fields+=`<div class="rotation-controls" aria-label="Поворот вокруг Z на 90 градусов">
   <button type="button" class="button" data-turn="-90" aria-label="Повернуть вокруг Z на минус 90 градусов">−90°</button>
   <button type="button" class="button" data-turn="90" aria-label="Повернуть вокруг Z на плюс 90 градусов">+90°</button>
  </div>`;
 }
 if(tiltable){
  fields+=propertyInput('tiltX','Вокруг X',e.tiltX??0,degrees)+propertyInput('tiltY','Вокруг Y',e.tiltY??0,degrees);
  fields+='<p class="property-note">X и Y наклоняют элемент в 3D. На плане его проекция видна пунктиром.</p>';
 }
 fields+='<p class="property-note">Стрелки сдвигают на 50 мм, Shift + стрелки — на 500 мм.</p>';
 return fields;
}
function renderGroupInspector(node){
 const items=[...selectedIds].map(id=>findElement(floor(),id)).filter(Boolean);
 const transferable=items.some(item=>!item.host);
 const allHaveMaterial=items.every(item=>typeof item.element.material==='string');
 const materials=[...new Set(items.map(item=>item.element.material))];
 node.innerHTML=`<div class="empty-selection"><i data-icon="cursor"></i><h2>Выбрано объектов: ${items.length}</h2><p>Перетащите любой выбранный объект, чтобы переместить всё выделение.</p></div>
 <section class="property-section group-actions">
  <button type="button" class="button" id="group-copy"><i data-icon="copy"></i>Дублировать</button>
  <button type="button" class="button" id="group-delete"><i data-icon="trash"></i>Удалить</button>
  ${transferable&&project.floors.length>1?`<div class="property-row"><label for="group-floor">Перенести на этаж</label><select id="group-floor">${floorOptions()}</select></div>`:''}
  ${allHaveMaterial?`<div class="property-row"><label for="group-material">Материал</label><select id="group-material">
   ${materials.length>1?'<option selected disabled>Разные материалы</option>':''}
   ${[...new Set([...materials,...materialNames])].map(material=>`<option ${materials.length===1&&materials[0]===material?'selected':''}>${escapeHTML(material)}</option>`).join('')}
   </select></div>`:''}
  ${items.some(item=>item.host&&!selectedIds.has(item.host.id))?'<p class="property-note">Проёмы переносятся между этажами вместе со стенами.</p>':''}
 </section>`;
 $('group-copy').onclick=copySelected;$('group-delete').onclick=removeSelected;
 if($('group-floor'))$('group-floor').onchange=event=>transferSelection(event.target.value);
 if($('group-material'))$('group-material').onchange=event=>{
  mutate(()=>{for(const item of items)item.element.material=event.target.value;},'Материал группы изменён');
 };
}
function transferSelection(floorIdTarget){
 const current=floor(),target=project.floors.find(level=>level.id===floorIdTarget);
 if(!target||target===current||![...selectedIds].some(id=>{
  const item=findElement(current,id);return item&&!item.host;
 }))return;
 const moved=mutate(()=>{
  setSelection(moveSelectionToFloor(current,target,selectedIds));floorId=target.id;draft=[];hover=null;editorFeedback={};
 },'Перенесено на этаж «'+target.name+'»');
 if(moved&&!preferences.allFloors)fitPlan();
}
function renderInspector(){
 renderElementList();
 const node=$('inspector-content'),item=selected();
 if(selectedIds.size>1){
  renderGroupInspector(node);
  hydrateIcons(node);
  return;
 }
 if(!item){node.innerHTML=`<div class="empty-selection"><i data-icon="cursor"></i><h2>Выберите элемент</h2><p>Нажмите на элемент и перетащите его мышью. Любой объект можно также выбрать в списке слева.</p><div class="project-summary"><div><span>Этаж</span><strong>${escapeHTML(floor().name)}</strong></div><div><span>Элементов</span><strong>${listElements(floor()).length}</strong></div></div></div>`;hydrateIcons(node);return;}
 const {element:e,host}=item,kind=elementIcon(e),cap=isRoundStructure(e)?pileCapFor(floor(),e.id):null;
 const tabs=[['geometry','Размеры'],['position','Положение']];
 let body=`<div class="element-title"><i data-icon="${kind}"></i><div><strong>${escapeHTML(e.name)}</strong><small>${escapeHTML(e.id.length>18?e.id.slice(0,14)+'…':e.id)}</small></div></div>
 <div class="inspector-tabs" role="group" aria-label="Разделы свойств">${tabs.map(([key,label])=>`<button type="button" data-inspector-tab="${key}" aria-pressed="${inspectorTab===key}">${label}</button>`).join('')}</div>
 <section class="property-section" ${inspectorTab==='geometry'?'':'hidden'}>`;
 if(e.kind==='wall')body+=propertyInput('thickness','Толщина',Math.round(e.thickness*1000),{min:50,max:1500})+propertyInput('height','Высота',Math.round(e.height*1000),{min:1000,max:15000})+propertyInput('length','Длина',Math.round(wallLength(e)*1000),{min:200,max:100000});
 else if(e.kind==='guide'){
  if(e.type==='line')body+=propertyInput('length','Длина линии',Math.round(wallLength(e)*1000),{min:10,max:3000000,step:1})
   +`<div class="property-row"><label for="property-style">Тип линии</label><select id="property-style" data-property="style">${Object.entries(GUIDE_STYLES).map(([key,label])=>`<option value="${key}" ${e.style===key?'selected':''}>${label}</option>`).join('')}</select></div>`
   +propertyInput('divisions','Число отрезков',e.divisions,{min:1,max:100,step:1,unit:'шт.'})
   +'<p class="property-note">Точки деления служат привязками. Например, 4 отрезка дают 3 внутренние точки.</p>';
  else body+='<p class="property-note">Опорная точка участвует в привязке и выравнивании. Задайте её координаты во вкладке «Положение».</p>';
 }
 else if(isStructure(e))body+=structureProperties(e);
 else if(host)body+=propertyInput('width','Ширина проёма',Math.round(e.width*1000),{min:300,max:10000,step:1})+propertyInput('height','Высота проёма',Math.round(e.height*1000),{min:300,max:15000,step:1})+propertyInput('sill','Отметка низа',Math.round(e.sill*1000),{min:0,max:15000,step:1});
 else if(e.kind==='slab')body+=propertyInput('thickness','Толщина',Math.round(e.thickness*1000),{min:50,max:1500})+`<div class="property-row"><span class="field-label">Площадь</span><span class="value-muted">${fmt(polygonArea(e.points),2)} м²</span></div>`;
 else if(e.kind==='furniture')body+=propertyInput('w','Ширина',Math.round(e.w*1000),{min:50,max:30000})+propertyInput('d','Глубина',Math.round(e.d*1000),{min:50,max:30000})+propertyInput('height','Высота',Math.round(e.height*1000),{min:5,max:15000});
 else if(e.kind==='room')body+=propertyInput('w','Ширина',Math.round(e.w*1000),{min:100,max:100000})+propertyInput('h','Глубина',Math.round(e.h*1000),{min:100,max:100000})+`<div class="property-row"><span class="field-label">Площадь</span><span class="value-muted">${fmt(e.w*e.h,2)} м²</span></div>`;
 else if(e.mode==='angle')body+=`<div class="property-row"><span class="field-label">Угол</span><span class="value-muted">${angleLabel(angleValue(e))}</span></div>`+propertyInput('radius','Радиус дуги',Math.round(e.radius*1000),{min:50,max:100000,step:1});
 else if(e.kind==='dimension')body+=`<div class="property-row"><span class="field-label">Длина</span><span class="value-muted">${fmt(wallLength(e)*1000)} мм</span></div>`+propertyInput('offset','Отступ',Math.round(e.offset*1000),{min:-100000,max:100000});
 if(['wall','slab'].includes(e.kind)||isStructure(e)){const materials=[...new Set([e.material,...materialNames])];body+=`<div class="property-row"><label for="property-material">Материал</label><select id="property-material" data-property="material">${materials.map(m=>`<option ${m===e.material?'selected':''}>${escapeHTML(m)}</option>`).join('')}</select></div>`;}
 body+=host?`<div class="property-row"><span class="field-label">Этаж стены</span><span class="value-muted">${escapeHTML(floor().name)}</span></div>`:`<div class="property-row"><label for="property-floorId">Этаж</label><select id="property-floorId" data-property="floorId">${floorOptions()}</select></div>`;
 if(e.kind==='doorway'||e.kind==='door'){
  const empty=e.kind==='doorway';
  body+=`<button type="button" class="button ${empty?'primary':''} opening-action" id="door-fill-action"><i data-icon="${empty?'door':'doorway'}"></i>${empty?'Вставить дверь':'Вынуть дверь'}</button>`;
 }
 if(isRoundStructure(e))body+=`<button type="button" class="button opening-action" id="pile-cap-action"><i data-icon="pile-cap"></i>${cap?'Выбрать оголовок':'Добавить оголовок'}</button>`;
 if(isPileCap(e)&&e.pileId!==undefined)body+=`<button type="button" class="button opening-action" id="detach-pile-cap">Отсоединить от сваи</button>`;
 if(isPileCap(e))body+=`<button type="button" class="button opening-action" id="cap-fasteners-action">Крепёж в отверстия</button>`;
 body+='</section>';
 body+=`<section class="property-section" ${inspectorTab==='position'?'':'hidden'}>${positionProperties(e,host)}</section>`;
 if(e.kind==='wall')body+=`<section class="property-section">${sectionTitle('Конструкция')}<div class="property-row"><label for="property-loadBearing">Несущая стена</label><input class="toggle" id="property-loadBearing" data-property="loadBearing" type="checkbox" ${e.loadBearing?'checked':''}></div><div class="property-row"><span class="field-label">Проёмы</span><span class="value-muted">${e.openings.length}</span></div><div class="property-row"><span class="field-label">Объём брутто</span><span class="value-muted">${fmt(wallLength(e)*e.thickness*e.height,2)} м³</span></div></section>`;
 if(e.kind!=='guide')body+=`<section class="property-section">${sectionTitle('Привязки')}<div class="property-row"><label for="property-showAxes">Оси симметрии</label><input class="toggle" id="property-showAxes" data-property="showAxes" type="checkbox" ${e.showAxes!==false?'checked':''}></div><p class="property-note">Квадратные ручки меняют размеры на плане. Alt временно отключает привязки.</p></section>`;
 body+=`<section class="property-section">${sectionTitle('Идентификация')}<label class="element-name-label" for="element-name">Название</label><input id="element-name" class="element-name-input" data-property="name" type="text" maxlength="100" value="${escapeHTML(e.name)}"><p class="property-note">${e.kind==='wall'?'Стена перемещается вместе со своими дверями и окнами.':'Параметры и положение сохраняются в проекте.'}</p></section>`;
 node.innerHTML=body;hydrateIcons(node);
 node.querySelectorAll('[data-inspector-tab]').forEach(button=>button.onclick=()=>{
  inspectorTab=button.dataset.inspectorTab;renderInspector();node.scrollTop=0;
  node.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
 });
 node.querySelectorAll('[data-property]').forEach(input=>{
  input.addEventListener('change',()=>updateProperty(input));
  if(input.tagName==='INPUT'&&input.type!=='checkbox')input.addEventListener('keydown',event=>{
   if(event.key==='Enter'){event.preventDefault();updateProperty(input);}
  });
 });
 node.querySelectorAll('[data-turn]').forEach(button=>button.onclick=()=>{
  mutate(()=>rotateElement(floor(),e.id,Number(button.dataset.turn)));
 });
 if($('door-fill-action'))$('door-fill-action').onclick=()=>changeDoor(e.id,e.kind==='doorway');
 if($('pile-cap-action'))$('pile-cap-action').onclick=()=>selectOrAddCap(e);
 if($('detach-pile-cap'))$('detach-pile-cap').onclick=()=>mutate(()=>delete e.pileId,'Оголовок отсоединён');
 if($('cap-fasteners-action'))$('cap-fasteners-action').onclick=()=>{
  if(!capHoles(e).length){toast('Включите отверстия оголовка в свойствах.');return;}
  chooseStructure('fastener',e);
 };
}
function updateProperty(input){
 const item=selected();
 if(!item||!input.isConnected)return;
 const key=input.dataset.property;
 if(input.tagName==='INPUT'&&input.type!=='checkbox'&&input.value===input.defaultValue)return;
 if(key==='floorId'){
  transferSelection(input.value);
  return;
 }
 const tilt=tiltFields.includes(key),degrees=key==='angle'||tilt;
 const value=key==='holeCount'?Number(input.value):input.type==='checkbox'?input.checked:input.type==='number'?input.valueAsNumber/(degrees||key==='divisions'?1:1000):input.value.trim();
 mutate(()=>{const {element:e,host}=item;
  if(typeof value==='number'){
   if(!Number.isFinite(value))throw new Error('Введите корректное число.');
   if(input.validity.rangeUnderflow||input.validity.rangeOverflow)throw new Error(`Допустимый диапазон — от ${input.min} до ${input.max} ${degrees?'°':key==='divisions'?'шт.':'мм'}.`);
  }
  if(key==='angle')setElementAngle(floor(),e.id,value);
  else if(tilt)setElementTilt(e,key,value);
  else if(key==='x'||key==='y'){const pos=elementPosition(e,host);translateElement(floor(),item.element.id,key==='x'?value-pos.x:0,key==='y'?value-pos.y:0);}
  else if(key==='length'){const old=wallLength(e),dx=(e.b.x-e.a.x)/old,dy=(e.b.y-e.a.y)/old;e.b={x:e.a.x+dx*value,y:e.a.y+dy*value};}else e[key]=value;
  if(host&&!canPlaceOpening(host,e,e.id))throw new Error('Проём выходит за границы стены или пересекает другой проём.');
  if(e.kind==='wall'&&e.openings.some(o=>!canPlaceOpening(e,o,o.id)))throw new Error('Размер стены не позволяет сохранить существующие проёмы.');
 });
}
async function ensureScene(){if(scene){refreshScene();scene.resize();return;}if(scenePromise)return scenePromise;scenePromise=(async()=>{try{const {createScene}=await import('./scene.js');scene=createScene($('model-container'),select,{start:beginElementDrag,move:previewElementDrag,end:finishElementDrag,cancel:cancelElementDrag,selectMany,context:showEditorMenu});refreshScene();scene.resize();}catch(error){$('model-container').innerHTML='<div class="model-error"><i data-icon="cube"></i>Не удалось запустить 3D.<br>Проверьте поддержку WebGL в браузере.<br>План и редактирование остаются доступны.</div>';hydrateIcons($('model-container'));console.error('3D initialization failed',error);}})();return scenePromise;}
function setView(next){view=next;$('viewports').dataset.mode=next;$$('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===next);button.setAttribute('aria-pressed',String(button.dataset.view===next));});if(next!=='plan')ensureScene();if(tool!=='select'&&next==='3d')setTool('select');}
const hints={select:'Ctrl + щелчок — добавить к выделению · Правая кнопка — меню',wall:'Укажите начало и конец стены · Shift — ортогонально · Esc — завершить',doorway:'Укажите место на стене и задайте размеры проёма',door:'Нажмите на пустой дверной проём',window:'Нажмите на стену, чтобы разместить окно',slab:'Задайте вершины контура · Enter — создать · Esc — отменить',dimension:'Укажите две точки, затем высоту размерной линии',room:'Задайте два противоположных угла помещения'};
function updateToolHint(){
 let hint=hints[tool];
 if(tool==='select'&&!listElements(floor()).length)hint='Пустой этаж · Выберите «Стена», «Плита» или добавьте мебель';
 if(tool==='slab')hint=`${floorLabel(floor())} · ${hint}`;
 if(tool==='angle')hint=['Укажите вершину угла','Укажите точку на первом луче','Укажите точку на втором луче'][draft.length];
 if(tool==='dimension')hint=['Размер · 1/3 · Укажите первую точку','Размер · 2/3 · Укажите вторую точку или введите длину','Размер · 3/3 · Задайте высоту размерной линии третьим щелчком'][draft.length];
 if(tool==='construction')hint=constructionType==='point'?'Укажите опорную точку для привязки':draft.length?'Укажите конец вспомогательной линии':'Укажите начало вспомогательной линии · Shift — ортогонально';
 if(tool==='pile-area')hint=`Сваи по области · Зажмите левую кнопку и задайте прямоугольник · Шаг ${fmt(pileSpacing*1000)} мм`;
 if(tool==='measure')hint=draft.length?'Линейка · Укажите вторую точку · Shift выравнивает замер'
  :measuredLine?.floorId===floorId?'Линейка · Щёлкните для нового замера · Esc закрывает замер':'Линейка · Укажите первую точку · Esc закрывает замер';
 if(tool==='structure'){
  const spec=STRUCTURE_TYPES[structureType],hintByShape={round:'Укажите центр сваи',rect:'Укажите центр опоры',fastener:'Укажите место установки · Центры отверстий доступны для привязки',line:draft.length?'Укажите конец элемента':'Укажите начало элемента',contour:hints.slab};
  hint=`${spec.name} · ${structureType==='pileCap'?'Щёлкните по свае или укажите свободную точку':hintByShape[spec.shape]}`;
 }
 $('canvas-hint').textContent=hint;
 $('tool-status').textContent=tool==='select'?'Выбор элементов':hint;
}
function setTool(next){
 tool=next;draft=[];hover=null;numericDirection=null;$('draw-length').value='';pileArea=null;measuredLine=null;editorFeedback={};
 $('construction-button').classList.toggle('active',next==='construction');
 $('construction-button').setAttribute('aria-pressed',String(next==='construction'));
 $$('[data-tool], [data-structure-category]').forEach(button=>{
  const active=button.dataset.tool===next||next==='structure'&&button.dataset.structureCategory===STRUCTURE_TYPES[structureType].kind||next==='pile-area'&&button.dataset.structureCategory==='foundation';
  button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 });
 updateToolHint();$('drawing-surface').classList.toggle('drawing',next!=='select');
 if(next!=='select'&&view==='3d')setView('plan');renderPlanView();refreshScene();
}
function worldPoint(event){const svg=$('plan-svg'),point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;return point.matrixTransform(svg.getScreenCTM().inverse());}
function snapped(point,event){let p={x:point.x,y:point.y};editorFeedback={};
 if(!event.altKey){
  if(preferences.snap){const result=snapPoint(p,snapTargets(floor(),null,preferences.axes,sceneOptions()),pixelUnit()*8,{alignment:preferences.guides,axes:preferences.axes});editorFeedback=result;if(result.label)p=result.point;}
  if(!editorFeedback.label&&preferences.gridSnap)p=snapToGrid(p,preferences.gridStep);
 }
 if(event.shiftKey&&draft.length&&!(tool==='dimension'&&draft.length===2)){const start=tool==='angle'?draft[0]:draft[draft.length-1];if(Math.abs(p.x-start.x)>Math.abs(p.y-start.y))p.y=start.y;else p.x=start.x;}
 const start=drawingStart();
 if(start){numericDirection={...p};const requested=drawLengthValue();if(requested!==null){p=endpointAtLength(start,p,requested);editorFeedback={};}}
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
 $('draw-length').value='';numericDirection=null;
 if(tool==='construction'){
  if(event.detail>1)return;
  if(constructionType!=='point'&&!draft.length){draft=[p];hover=null;updateToolHint();renderPlanView();return;}
  const start=draft[0];draft=[];hover=null;editorFeedback={};
  if(start&&length(sub(p,start))<.01){toast('Минимальная длина линии — 10 мм.');updateToolHint();renderPlanView();return;}
  const e=constructionType==='point'
   ?{id:uid('ТЧ'),kind:'guide',type:'point',name:'Опорная точка',x:p.x,y:p.y}
   :{id:uid('ВЛ'),kind:'guide',type:'line',name:'Вспомогательная линия',a:start,b:p,style:constructionType,divisions:1};
  mutate(()=>{floor().construction.push(e);setSelection([e.id]);},e.name+' добавлена');return;
 }
 if(tool==='measure'){
  const a=draft[0];
  if(a&&length(sub(p,a))>1e-8){measuredLine={a,b:p,floorId};draft=[];}
  else{measuredLine=null;draft=[p];}
  hover=null;editorFeedback={};updateToolHint();renderPlanView();return;
 }
 if(tool==='structure'){
  const spec=STRUCTURE_TYPES[structureType];
  if(structureType==='pileCap'){
   const pointed=findElement(floor(),event.target.closest('[data-element]')?.dataset.element)?.element;
   const pile=isRoundStructure(pointed)?pointed:closestPile(p);
   if(pile){
    const existing=pileCapFor(floor(),pile.id);
    if(existing){select(existing.id);toast('На этой свае уже есть оголовок.');}
    else addStructure([p],'pileCap',pile);
   }else addStructure([p]);
   return;
  }
  if(spec.shape==='fastener'){addStructure([p],structureType,null,event.altKey);return;}
  if((spec.shape==='line'||spec.shape==='contour')&&event.detail>1)return;
  if(spec.shape==='line'||spec.shape==='contour'){
   draft.push(p);hover=null;
   if(spec.shape==='line'&&draft.length===2){
    const points=draft;draft=[];
    if(length(sub(points[0],points[1]))<.05){toast('Минимальная длина — 50 мм.');updateToolHint();renderPlanView();return;}
    addStructure(points);
   }else{updateToolHint();renderPlanView();}
  }else addStructure([p]);
  return;
 }
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
 if(tool==='dimension'){
  if(draft.length===1&&length(sub(p,draft[0]))<.2){toast('Минимальная длина — 200 мм.');return;}
  if(draft.length<2){draft.push(p);hover=null;editorFeedback={};updateToolHint();renderPlanView();return;}
  const [a,b]=draft,offset=Math.max(-100,Math.min(100,linearDimensionOffset(a,b,p)));
  draft=[];hover=null;editorFeedback={};
  mutate(()=>{const id=uid('РЗ');floor().dimensions.push({id,kind:'dimension',name:'Размер',a,b,offset});setSelection([id]);},'Размер добавлен');
  return;
 }
 if(tool==='wall'||tool==='room'){draft.push(p);if(draft.length===2){const [a,b]=draft;draft=[];hover=null;if(Math.hypot(a.x-b.x,a.y-b.y)<.2){toast('Минимальная длина — 200 мм.');renderPlanView();return;}mutate(()=>{const id=uid(tool==='wall'?'СТ':'ПМ');if(tool==='wall'){floor().walls.push({id,kind:'wall',name:'Новая стена',a,b,thickness:.3,height:floor().height,material:'Кирпич',loadBearing:false,openings:[]});}else floor().rooms.push({id,kind:'room',name:'Помещение '+(floor().rooms.length+1),x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)});setSelection([id]);},tool==='wall'?'Стена добавлена':'Помещение добавлено');}else renderPlanView();
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
function closestPile(point){
 let best=null,bestDistance=Infinity;
 for(const e of floor().structures){
  if(!isRoundStructure(e))continue;
  const distance=length(sub(e,point));
  if(distance<bestDistance&&distance<=Math.max(e.diameter/2,pixelUnit()*10)){
   best=e;bestDistance=distance;
  }
 }
 return best;
}
function selectOrAddCap(pile){
 const existing=pileCapFor(floor(),pile.id);
 inspectorTab='geometry';
 if(tool!=='select')setTool('select');
 if(existing)select(existing.id);
 else addStructure([{x:pile.x,y:pile.y}],'pileCap',pile);
}
function nearestCapHole(point){
 let nearest=null,distance=pixelUnit()*10;
 for(const cap of floor().structures.filter(isPileCap))for(const hole of capHoles(cap)){
  const current=length(sub(point,hole));
  if(current<distance){distance=current;nearest={point:hole,cap};}
 }
 return nearest;
}
function installCapFasteners(cap,type){
 const holes=capHoles(cap),spec=STRUCTURE_TYPES[type];
 if(!isRingFastener({type})&&spec.sizes.diameter>capHoleSettings(cap).diameter+1e-9){toast('Крепёж шире отверстия. Увеличьте диаметр отверстий или выберите меньший крепёж.');return;}
 const created=holes.filter(p=>!floor().structures.some(e=>isFastener(e)&&e.type===type&&Math.hypot(e.x-p.x,e.y-p.y)<1e-6&&Math.abs(e.elevation-cap.elevation)<1e-6))
  .map(p=>({...makeStructure(type,uid('КП'),[p]),elevation:cap.elevation,rotation:cap.rotation}));
 if(!created.length){toast('Такой крепёж уже установлен во всех отверстиях.');return;}
 $('modal').close();setTool('select');
 mutate(()=>{floor().structures.push(...created);setSelection(created.map(e=>e.id));},'Установлено крепежей · '+created.length);
}
function addStructure(points,type=structureType,pile,disableSnap=false){
 const spec=STRUCTURE_TYPES[type],origin=pile?[{x:pile.x,y:pile.y}]:points;
 const e=makeStructure(type,uid(spec.kind==='foundation'?'ФН':spec.kind==='fastener'?'КП':'КР'),origin);
 if(pile)e.pileId=pile.id;
 if(isFastener(e)&&preferences.snap&&!disableSnap){const mount=nearestCapHole(points[0]);if(mount){e.x=mount.point.x;e.y=mount.point.y;e.elevation=mount.cap.elevation;e.rotation=mount.cap.rotation;}}
 hover=null;editorFeedback={};
 mutate(()=>{floor().structures.push(e);setSelection([e.id]);},pile?'Оголовок закреплён на свае':e.name+' · добавлено');
}
function drawingContour(){return tool==='slab'||tool==='structure'&&STRUCTURE_TYPES[structureType].shape==='contour';}
function finishContour(){
 if(draft.length<3){toast('Для контура нужны минимум три вершины.');return;}
 if(polygonArea(draft)<.1||!isSimplePolygon(draft)){toast('Контур должен иметь площадь от 0,1 м² и не пересекать себя.');return;}
 const points=draft;draft=[];hover=null;editorFeedback={};
 if(tool==='structure'){addStructure(points);return;}
 const id=uid('ПЛ');
 mutate(()=>{floor().slabs.push({id,kind:'slab',name:'Перекрытие',points,thickness:.2,material:'Бетон'});setSelection([id]);},'Перекрытие добавлено');
}
function removeSelected(){
 if(!selectedIds.size)return;
 const item=selected();
 if(item?.host&&item.element.kind==='door'){changeDoor(item.element.id,false);return;}
 mutate(()=>{
  const current=floor(),remaining=[],deleted=linkedPileSelection(current,selectedIds,false);
  for(const wall of current.walls){
   if(deleted.has(wall.id))continue;
   wall.openings=wall.openings.filter(o=>{
    if(!deleted.has(o.id))return true;
    if(!setOpeningDoor(o,false))return false;
    remaining.push(o.id);return true;
   });
  }
  for(const key of FLOOR_COLLECTIONS)current[key]=current[key].filter(e=>!deleted.has(e.id));
  setSelection(remaining);
 },'Удаление выполнено · Ctrl+Z — отменить');
}
function copySelected(){
 if(!selectedIds.size)return;
 mutate(()=>{
  const current=floor(),ids=linkedPileSelection(current,selectedIds);
  const items=[...ids].map(id=>findElement(current,id)).filter(item=>item&&!ids.has(item.host?.id));
  const copies=new Map(items.map(({element})=>[element.id,uid(element.kind)]));
  for(const item of items){
   const copy=clone(item.element);copy.id=copies.get(item.element.id);
   if(item.host){
    copy.position+=copy.width+.2;
    if(!canPlaceOpening(item.host,copy))throw new Error('На стене недостаточно места для копии.');
    item.host.openings.push(copy);
   }else{
    if(copy.kind==='wall')copy.openings.forEach(o=>o.id=uid(o.kind));
    const attached=isPileCap(copy)&&copy.pileId!==undefined;
    if(attached)copy.pileId=copies.get(copy.pileId);
    current[item.collection].push(copy);
    if(!attached)translateElement(current,copy.id,.5,.5);
   }
  }
  setSelection(copies.values());
 },'Копии созданы');
}
function elementIcon(e){return e.kind==='guide'?(e.type==='point'?'axis':'align'):isStructure(e)?STRUCTURE_TYPES[e.type].icon:e.mode==='angle'?'angle':({wall:'wall',slab:'layers',doorway:'doorway',door:'door',window:'window',furniture:'cube',room:'home',dimension:'dimension'}[e.kind]||'cube');}
function renderElementList(){const list=$('elements-list');if(!list)return;const previousScroll=list.scrollTop;list.replaceChildren();const all=listElements(floor());$('elements-count').textContent=all.length;for(const e of all){const button=document.createElement('button');button.className='element-list-item'+(selectedIds.has(e.id)?' active':'');button.setAttribute('aria-pressed',String(selectedIds.has(e.id)));button.dataset.elementId=e.id;button.innerHTML=`<i data-icon="${elementIcon(e)}"></i><span></span>`;button.querySelector('span').textContent=e.name;button.title=e.name+' · '+e.id;button.onclick=event=>{setTool('select');select(e.id,extendSelection(event));};list.append(button);}if(!all.length){const note=document.createElement('p');note.className='empty-elements';note.textContent='Пока нет элементов. Начните со стены.';list.append(note);}hydrateIcons(list);list.scrollTop=previousScroll;}
function beginElementDrag(id,point,handle=null){
 if(!findElement(floor(),id))return;
 if(!selectedIds.has(id))select(id);
 else editorFeedback={};
 const ids=[...linkedPileSelection(floor(),selectedIds)];
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
   let target={x:point.x,y:point.y};
   if(preferences.snap&&!disableSnap){feedback=snapPoint(target,drag.targets,tol,{alignment:preferences.guides,axes:preferences.axes});if(feedback.label)target=feedback.point;}
   if(!feedback.label&&preferences.gridSnap&&!disableSnap)target=snapToGrid(target,preferences.gridStep);
   resizeElement(candidateFloor,drag.id,drag.handle,target);description='Изменение размера';
   const actual=findElement(candidateFloor,drag.id),edited=actual.element,handle=transformHandles(edited,actual.host,pixelUnit()).find(h=>h.key===drag.handle);
   if(handle&&(drag.handle==='diameter'||drag.handle==='bladeDiameter'))description=`${handle.label} · ${fmt(edited[drag.handle]*1000)} мм`;
   else if(edited.a&&edited.mode!=='angle')description=`Длина · ${fmt(wallLength(edited)*1000)} мм`;
   if(handle)feedback=accurateFeedback(feedback,[handle]);
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
    if(feedback.label){dx=feedback.dx;dy=feedback.dy;}
   }
   if(!feedback.label&&preferences.gridSnap&&!disableSnap){
    const anchor=elementPosition(original.element,original.host),target=snapToGrid({x:anchor.x+dx,y:anchor.y+dy},preferences.gridStep);
    dx=target.x-anchor.x;dy=target.y-anchor.y;
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
function applyPreferenceButtons(){for(const [id,key] of [['grid-button','grid'],['grid-snap-button','gridSnap'],['labels-button','labels'],['dimensions-button','dimensions'],['snap-button','snap'],['guides-button','guides']]){$(id).classList.toggle('active',preferences[key]);$(id).setAttribute('aria-pressed',String(preferences[key]));} $('axes-button').classList.toggle('active',preferences.axes);syncAxisOptions();}
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
  if(item&&isRoundStructure(item.element))add(pileCapFor(floor(),item.element.id)?'Выбрать оголовок':'Добавить оголовок','pile-cap',()=>selectOrAddCap(item.element));
  if(item&&$('inspector-content').offsetWidth)add('Свойства','edit',()=>$('inspector-content').querySelector('.property-section:not([hidden]) [data-property]')?.focus());
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
function chooseConstruction(){
 modal('Вспомогательная геометрия',`<div class="structure-picker">
  ${[...Object.entries(GUIDE_STYLES),['point','Опорная точка']].map(([key,name])=>`<button type="button" data-construction="${key}"><i data-icon="${key==='point'?'axis':'align'}"></i><span><strong>${name}</strong><small>${key==='point'?'По точке':'По двум точкам'}</small></span></button>`).join('')}
 </div>`);
 $$('[data-construction]').forEach(button=>button.onclick=()=>{
  constructionType=button.dataset.construction;inspectorTab='geometry';$('modal').close();setTool('construction');
 });
}
function chooseStructure(category,cap){
 const options=Object.entries(STRUCTURE_TYPES).filter(([,spec])=>spec.kind===category);
 const methods={round:'По точке',rect:'По точке',fastener:'По точке · Размеры в свойствах',line:'По двум точкам',contour:'По контуру'};
 modal(category==='foundation'?'Фундаменты':category==='fastener'?cap?'Крепёж в отверстия оголовка':'Крепёж':'Каркас перекрытия',`<div class="structure-picker">
  ${category==='foundation'?`<button type="button" id="pile-area-button"><i data-icon="pile"></i><span><strong>Сваи по области</strong><small>Края и деление пополам · шаг ${fmt(pileSpacing*1000)} мм</small></span></button>`:''}
  ${options.map(([type,spec])=>`<button type="button" data-structure="${type}">
   <i data-icon="${spec.icon}"></i><span><strong>${spec.name}</strong><small>${type==='rim'?'3 доски 200 × 50 мм · ':''}${methods[spec.shape]}</small></span>
  </button>`).join('')}
 </div>`);
 if($('pile-area-button'))$('pile-area-button').onclick=choosePileArea;
 $$('[data-structure]').forEach(button=>button.onclick=()=>{
  if(cap){installCapFasteners(cap,button.dataset.structure);return;}
  structureType=button.dataset.structure;inspectorTab='geometry';$('modal').close();setTool('structure');
 });
}
function choosePileArea(){
 $('modal').close();
 modal('Сваи по области',`<form id="pile-area-form" class="floor-form">
  <label for="pile-area-type">Тип свай</label><select id="pile-area-type"><option value="screwPile">Винтовые сваи</option><option value="pile">Бетонные сваи</option></select>
  <label for="pile-area-step">Шаг свай, мм</label><input id="pile-area-step" type="number" min="100" max="100000" step="1" value="${pileSpacing*1000}" required>
  <p>Перетащите мышь по плану, чтобы задать прямоугольник. Сначала сваи ставятся по краям. Промежутки делятся пополам, пока расстояние между соседними сваями не станет меньше заданного шага. По тем же осям заполняется область внутри.</p>
  <div class="modal-actions"><button type="submit" class="button primary">Задать область мышью</button></div>
 </form>`);
 $('pile-area-type').value=pileAreaType;
 $('pile-area-form').onsubmit=event=>{
  event.preventDefault();pileAreaType=$('pile-area-type').value;pileSpacing=$('pile-area-step').valueAsNumber/1000;
  $('modal').close();setTool('pile-area');
 };
}
function updatePileArea(point){
 pileArea.b=point;
 try{
  pileArea.points=pileAreaPoints(pileArea.a,point,pileSpacing,2000);pileArea.error='';
  $('tool-status').textContent=`Свай в области · ${pileArea.points.length} · Отпустите кнопку для создания`;
 }catch(error){pileArea.points=[];pileArea.error=error.message;$('tool-status').textContent=error.message;}
 renderPlanView();
}
function finishPileArea(event){
 const area=pileArea;pileArea=null;editorFeedback={};
 if(Math.hypot(event.clientX-area.screen.x,event.clientY-area.screen.y)<5){renderPlanView();return;}
 if(area.error){toast(area.error);renderPlanView();return;}
 if(Math.abs(area.a.x-area.b.x)<.2||Math.abs(area.a.y-area.b.y)<.2){toast('Задайте область шириной и длиной от 200 мм.');renderPlanView();return;}
 const existing=floor().structures.filter(isRoundStructure);
 const points=area.points.filter(p=>!existing.some(e=>Math.hypot(p.x-e.x,p.y-e.y)<1e-6));
 if(!points.length){toast('В этих точках сваи уже установлены.');renderPlanView();return;}
 if(points.length+floor().structures.length>2000){toast('На этаже поддерживается до 2000 конструктивных элементов. Уменьшите область.');renderPlanView();return;}
 const created=points.map(p=>makeStructure(pileAreaType,uid('ФН'),[p]));
 mutate(()=>{floor().structures.push(...created);setSelection(created.map(e=>e.id));},'Добавлено свай · '+created.length);
 setTool('select');
}
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
    project.floors.push({id,...settings,walls:[],slabs:[],furniture:[],rooms:[],dimensions:[],structures:[],construction:[]});
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
$$('[data-structure-category]').forEach(button=>button.onclick=()=>chooseStructure(button.dataset.structureCategory));
$('construction-button').onclick=chooseConstruction;
$$('[data-library]').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.library)));
$$('[data-view]').forEach(button=>button.addEventListener('click',()=>{section=false;setView(button.dataset.view);refreshScene();}));
$$('[data-sidebar]').forEach(button=>button.addEventListener('click',()=>{$$('[data-sidebar]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-selected',String(b===button));});$('project-panel').hidden=button.dataset.sidebar!=='project';$('library-panel').hidden=button.dataset.sidebar!=='library';}));
$$('[data-collapse]').forEach(button=>button.addEventListener('click',()=>{const content=$(button.dataset.collapse);content.hidden=!content.hidden;button.setAttribute('aria-expanded',String(!content.hidden));button.querySelector('i').classList.toggle('rotated',content.hidden);}));
$('undo').onclick=undo;$('redo').onclick=redo;$('copy-button').onclick=copySelected;$('delete-button').onclick=removeSelected;$('deselect-button').onclick=()=>select(null);
$('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);$('zoom-fit').onclick=fitPlan;$('scale-button').onclick=fitPlan;$('focus-button').onclick=()=>{fitPlan();scene?.reset();};$('reset-camera').onclick=()=>scene?.reset();
for(const [id,key] of [['grid-button','grid'],['grid-snap-button','gridSnap'],['labels-button','labels'],['dimensions-button','dimensions'],['snap-button','snap'],['guides-button','guides']])$(id).onclick=()=>togglePreference(key);
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
function showHelp(){modal('Быстрый старт','<p>Выберите стену на плане, измените её размеры справа и откройте 3D. Для построения стены укажите две точки.</p>'+[['Выбор / перемещение','V → перетащить'],['Выделение рамкой','Мышь / Shift + мышь'],['Добавить или убрать из выделения','Ctrl + щелчок'],['Добавить рамкой','Ctrl + перетаскивание'],['Изменение размера','Квадратные ручки'],['Поворот','Ручка или угол в свойствах'],['Шаг поворота 15°','Shift'],['Отключить привязки','Alt'],['Точный сдвиг','Стрелки / Shift+стрелки'],['Стена','W'],['Дверной проём','G → стена → размеры'],['Вставить дверь','D → пустой проём'],['Окно','O'],['Контекстное меню','Правая кнопка / Shift+F10'],['Перекрытие','P → точки → Enter'],['Фундаменты / каркас','Выберите тип слева'],['Линейка','L → две точки'],['Размер','M → две точки'],['Угловой размер','A → вершина → по точке на лучах'],['Помещение','R → два угла'],['Панорама плана','Пробел + перетаскивание'],['Масштаб','Колесо мыши'],['Вписать модель','F'],['Отмена / повтор','Ctrl+Z / Ctrl+Shift+Z'],['Дублировать','Ctrl+D'],['Удалить','Delete'],['Завершить инструмент','Esc']].map(([label,key])=>`<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`).join(''));}
$('help-button').onclick=showHelp;
$('settings-button').onclick=()=>{
 modal('Отображение и сетка',`<p>Настройки сохраняются на этом устройстве.</p>
  ${[['grid','Показывать сетку'],['gridSnap','Привязка к сетке'],['dark','Тёмная тема'],['textures','Текстуры материалов'],['rulers','Координатные линейки'],['labels','Названия помещений'],['dimensions','Размеры'],['snap','Привязки к элементам'],['axes','Оси деталей и привязки к осям'],['guides','Направляющие и выравнивание']].map(([key,label])=>`<label class="settings-option">${label}<input class="toggle" type="checkbox" data-pref="${key}" ${preferences[key]?'checked':''}></label>`).join('')}
  <form id="grid-step-form" class="floor-form"><label for="grid-step">Шаг сетки, мм</label>
  <input id="grid-step" type="number" min="10" max="100000" step="1" required value="${preferences.gridStep*1000}">
  <div class="modal-actions"><button type="submit" class="button primary">Применить шаг</button></div></form>`);
 $$('[data-pref]').forEach(input=>input.onchange=()=>{preferences[input.dataset.pref]=input.checked;savePreferences();render();});
 $('grid-step-form').onsubmit=event=>{
  event.preventDefault();const step=$('grid-step').valueAsNumber/1000;
  if(!validGridStep(step))return;
  preferences.gridStep=step;savePreferences();render();toast('Шаг сетки — '+fmt(step*1000)+' мм');
 };
};
const surface=$('drawing-surface');
$('draw-length-form').onsubmit=event=>{
 event.preventDefault();commitDrawingLength();$('plan-svg').focus({preventScroll:true});
};
$('draw-length').addEventListener('input',()=>renderPlanView());
$('draw-length').addEventListener('keydown',event=>{
 if(event.key==='Escape'){
  event.preventDefault();event.stopPropagation();$('draw-length').value='';$('plan-svg').focus({preventScroll:true});renderPlanView();
 }
});
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
 if(tool==='pile-area'){
  event.preventDefault();surface.setPointerCapture(event.pointerId);
  const start=snapped(p,event);pileArea={a:start,b:start,points:[],screen:pointerPosition(event),error:''};return;
 }
 if(tool!=='select'){choosePoint(snapped(p,event),event);return;}
 const handle=event.target.closest('[data-handle]'),ctrl=event.ctrlKey||event.metaKey;
 let element=event.target.closest('[data-element]');
 if(handle&&ctrl)element=document.elementsFromPoint(event.clientX,event.clientY).find(node=>node.hasAttribute('data-element'));
 const id=element?.dataset.element||handle?.dataset.owner;
 const extend=extendSelection(event);
 surface.setPointerCapture(event.pointerId);
 if((handle&&!ctrl)||id&&!extend){
  beginElementDrag(id,p,handle?.dataset.handle||null);
  if(movement){movement.pointerStart=pointerPosition(event);surface.classList.add('moving-element');}
 }else marquee={pointerStart:pointerPosition(event),worldStart:p,extend,id,active:false};
});
surface.addEventListener('pointermove',event=>{
 if(pan){const matrix=$('plan-svg').getScreenCTM();camera.x=pan.camera.x-(event.clientX-pan.x)/matrix.a;camera.y=pan.camera.y-(event.clientY-pan.y)/matrix.d;updateViewBox();return;}
 const p=worldPoint(event);
 if(pileArea){updatePileArea(snapped(p,event));return;}
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
 if(pileArea){finishPileArea(event);endPan();return;}
 if(marquee){
  const {active,worldStart,extend,id}=marquee;
  clearMarquee();
  if(active)selectMany(selectInPlan(floor(),selectionBounds(worldStart,worldPoint(event)),sceneOptions()),extend);
  else if(id||!extend)select(id,extend);
 }else finishElementDrag();
 endPan();
});
surface.addEventListener('pointercancel',()=>{pileArea=null;clearMarquee();cancelElementDrag();endPan();renderPlanView();});
surface.addEventListener('lostpointercapture',()=>{if(marquee||movement||pan||pileArea){pileArea=null;clearMarquee();cancelElementDrag();endPan();renderPlanView();}});
surface.addEventListener('dblclick',()=>{if(drawingContour())finishContour();});
surface.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,event.deltaY))*.0017),worldPoint(event));},{passive:false});
document.addEventListener('keydown',event=>{
 if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&!$('modal').open&&!event.target.closest('input,select,textarea')&&drawingStart()&&/^[0-9.,]$/.test(event.key)){
  event.preventDefault();const input=$('draw-length');input.value=event.key==='.'||event.key===','?'0.':event.key;input.focus({preventScroll:true});renderPlanView();return;
 }
 if(event.target.closest('input,select,textarea')||$('modal').open)return;
 if(pileArea&&(event.key==='Escape'||(event.ctrlKey||event.metaKey)&&event.code==='KeyZ')){
  event.preventDefault();pileArea=null;editorFeedback={};updateToolHint();renderPlanView();return;
 }
 if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){
  const target=event.target.closest('#plan-svg,#model-container canvas,[data-element-id]');
  if(!target)return;
  event.preventDefault();
  const {left,top,width,height}=target.getBoundingClientRect();
  showEditorMenu({target,clientX:left+width/2,clientY:top+height/2},target.dataset.elementId||singleSelection(),null);return;
 }
 const ctrl=event.ctrlKey||event.metaKey;
 const pressed=event.key.toLowerCase(),key=/^[а-яё]$/.test(pressed)&&event.code.startsWith('Key')?event.code.slice(3).toLowerCase():pressed;if(ctrl&&key==='z'&&(movement||marquee||scene?.cancelSelection())){event.preventDefault();clearMarquee();cancelElementDrag();return;}if(ctrl&&key==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}if(ctrl&&key==='y'){event.preventDefault();redo();return;}if(ctrl&&key==='d'){event.preventDefault();copySelected();return;}if(ctrl&&key==='s'){event.preventDefault();save();toast(saveFailed?'Скачайте проект через «Экспорт».':'Проект сохранён на устройстве.');return;}if(ctrl)return;if(event.code==='Space'){event.preventDefault();spaceHeld=true;return;}if(key==='escape'){clearMarquee();cancelElementDrag();draft=[];setTool('select');closeMenus();return;}if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)&&selectedIds.size){event.preventDefault();const step=event.shiftKey?.5:.05;nudgeSelected(key==='arrowleft'?-step:key==='arrowright'?step:0,key==='arrowup'?-step:key==='arrowdown'?step:0);return;}if(key==='enter'&&drawingContour()){event.preventDefault();finishContour();return;}if(['delete','backspace'].includes(key)){event.preventDefault();removeSelected();return;}if(key==='f'){fitPlan();scene?.reset();return;}if(key==='?'){showHelp();return;}const mapping={v:'select',w:'wall',g:'doorway',d:'door',o:'window',p:'slab',l:'measure',m:'dimension',a:'angle',r:'room'};if(mapping[key]){event.preventDefault();setTool(mapping[key]);}});
document.addEventListener('keyup',event=>{if(event.code==='Space')spaceHeld=false;});window.addEventListener('blur',()=>{spaceHeld=false;pileArea=null;clearMarquee();cancelElementDrag();endPan();renderPlanView();});
window.addEventListener('storage',event=>{if([STORAGE_KEY,CATALOG_KEY].includes(event.key)&&event.newValue)toast('Проект изменён в другой вкладке. Скачайте текущую копию перед перезагрузкой.');});
if(loadWarning)toast(loadWarning);
