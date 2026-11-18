const MATERIALS = [
 {name:'Кирпич', id:'brick', base:'#bd735e', line:'#edc5aa', dark:'#925649', darkLine:'#ba8980',
  stroke:2.1, paths:[[[0,0],[100,0]],[[0,50],[100,50]],[[0,0],[0,50]],[[50,50],[50,100]]]},
 {name:'Газобетон', id:'block', base:'#c4c8bc', line:'#8c9990', dark:'#69756e', darkLine:'#9daea5',
  stroke:1.8, paths:[[[0,0],[100,0]],[[0,50],[100,50]],[[0,0],[0,50]],[[50,50],[50,100]]],
  dots:[[12,20,1],[28,32,1],[47,20,1.2],[78,12,1.4],[90,33,1],[18,74,1],[40,68,1.2],[60,85,1.3],[83,65,1]]},
 {name:'Бетон', id:'concrete', base:'#aeb4bd', line:'#747e8b', dark:'#687384', darkLine:'#9dabbc',
  stroke:1.8, paths:[[[12,20],[18,14],[21,21],[12,20]],[[54,55],[58,46],[62,52],[54,55]],[[83,16],[88,21],[80,24],[83,16]],[[18,80],[25,82],[23,74],[18,80]],[[74,83],[83,86],[80,77],[74,83]]],
  dots:[[5,35,1],[39,26,1.2],[65,10,1],[72,38,1.4],[89,60,1.4],[39,75,1.2],[46,94,1.8],[94,32,1]]},
 {name:'Дерево', id:'wood', base:'#c5a779', line:'#8c6d43', dark:'#8b6d4b', darkLine:'#c6a16f',
  stroke:1.4, paths:[[[0,0],[100,0]],[[0,33],[100,33]],[[0,66],[100,66]],[[19,0],[19,33]],[[74,33],[74,66]],[[39,66],[39,100]],
   [[0,16],[23,14],[38,8],[57,12],[77,18],[100,16]],[[0,53],[27,48],[49,54],[68,50],[100,53]],[[0,83],[24,77],[45,84],[72,86],[100,83]]]},
 {name:null, id:'other', base:'#a49aa9', line:'#6e6375', dark:'#736a7c', darkLine:'#a99ab4',
  stroke:1.8, paths:[[[0,0],[100,100]],[[0,50],[50,100]],[[50,0],[100,50]]]}
];

export const materialNames=MATERIALS.flatMap(spec=>spec.name?[spec.name]:[]);
export function materialSpec(name){return MATERIALS.find(spec=>spec.name===name)||MATERIALS.at(-1);}

export function materialPatterns(dark) {
 return MATERIALS.map(spec=>{
  const fill=dark?spec.dark:spec.base, line=dark?spec.darkLine:spec.line;
  const paths=spec.paths.map(points=>`<polyline points="${points.map(p=>p.join(',')).join(' ')}"/>`).join('');
  const dots=(spec.dots||[]).map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  const tile=spec.id==='brick'?.24:spec.id==='block'?.5:.43;
  return `<pattern id="material-${spec.id}" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse" viewBox="0 0 100 100"><rect width="100" height="100" fill="${fill}"/><g fill="none" stroke="${line}" stroke-width="${spec.stroke}">${paths}</g><g fill="${line}">${dots}</g></pattern>`;
 }).join('');
}

export function createMaterialTexture(THREE,spec){
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=128;
 const context=canvas.getContext('2d');
 context.scale(1.28,1.28);
 context.fillStyle=spec.base;context.fillRect(0,0,100,100);
 context.strokeStyle=spec.line;context.lineWidth=spec.stroke;
 for(const points of spec.paths){
  context.beginPath();
  points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));
  context.stroke();
 }
 context.fillStyle=spec.line;
 for(const [x,y,radius] of spec.dots||[]){context.beginPath();context.arc(x,y,radius,0,Math.PI*2);context.fill();}
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 const repeat=spec.id==='brick'?4:spec.id==='block'?2:2.3;
 texture.repeat.set(repeat,repeat);
 return texture;
}
