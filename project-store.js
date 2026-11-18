import {clone,createDemo,validateProject} from './model.js';
export const CATALOG_KEY='bim-workspace-library-v1';
export const LEGACY_KEY='bim-workspace-project-v1';
export function loadProjects(storage){
 const raw=storage.getItem(CATALOG_KEY);
 if(raw){const catalog=JSON.parse(raw);if(catalog.version!==1||!Array.isArray(catalog.projects)||!catalog.projects.length)throw new Error('Некорректный список проектов.');const projects=catalog.projects.map(p=>validateProject(p));const active=projects.find(p=>p.id===catalog.activeId)||projects[0];return {projects,project:clone(active)};}
 const legacy=storage.getItem(LEGACY_KEY),project=legacy?validateProject(JSON.parse(legacy)):createDemo();return {projects:[clone(project)],project};
}
export function saveProjects(storage,projects,project){
 validateProject(project);const next=projects.filter(p=>p.id!==project.id).concat(clone(project));
 // One atomic write preserves all other projects if the browser quota is exceeded.
 storage.setItem(CATALOG_KEY,JSON.stringify({version:1,activeId:project.id,projects:next}));return next;
}
