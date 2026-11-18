export function buildFurniture(THREE,group,item,selectedMaterial){
 const root=new THREE.Group();root.position.set(item.x-6,0,item.y-4.5);root.rotation.y=-item.rotation*Math.PI/180;group.add(root);
 const {w,d,height:h,type,id}=item;
 const mat=color=>selectedMaterial||new THREE.MeshStandardMaterial({color,roughness:.85});
 const wood=mat(0xcbbda6),fabric=mat(0xe9e5dc),white=mat(0xefeeea),metal=mat(0x68737b);
 function box(bw,bh,bd,x,y,z,m){const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.005,bw),Math.max(.005,bh),Math.max(.005,bd)),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.elementId=id;root.add(mesh);return mesh;}
 if(['desk','table','coffee'].includes(type)){box(w,.07,d,w/2,h-.035,d/2,wood);for(const x of [.08,w-.08])for(const z of [.08,d-.08])box(.05,h-.07,.05,x,(h-.07)/2,z,metal);if(type==='desk'){box(w*.32,.02,d*.4,w/2,h+.01,d*.4,metal);}}
 else if(type==='sofa'){box(w,h*.5,d,w/2,h*.25,d/2,fabric);box(w,h*.5,.18,w/2,h*.75,.09,fabric);for(const x of [.08,w-.08])box(.16,h*.75,d,x,h*.375,d/2,fabric);for(let i=0;i<3;i++)box((w-.38)/3,.08,d-.26,.19+(i+.5)*(w-.38)/3,h*.53,d/2+.06,white);}
 else if(type==='chair'){box(w,.08,d,w/2,h*.52,d/2,fabric);box(w,h*.45,.055,w/2,h*.77,.035,wood);for(const x of [.06,w-.06])for(const z of [.06,d-.06])box(.04,h*.5,.04,x,h*.25,z,metal);}
 else if(type==='bed'){box(w,h*.5,d,w/2,h*.25,d/2,wood);box(w-.08,h*.5,d-.08,w/2,h*.75,d/2,fabric);for(const x of [w*.26,w*.74])box(w*.4,.1,.4,x,h+.05,.35,white);}
 else if(type==='plant'){box(w*.7,h*.33,d*.7,w/2,h*.165,d/2,white);const leaves=new THREE.Mesh(new THREE.SphereGeometry(Math.min(w,d)*.6,10,8),mat(0x8c9f78));leaves.position.set(w/2,h*.66,d/2);leaves.scale.y=h*.5/(Math.min(w,d)*.6);leaves.userData.elementId=id;leaves.castShadow=true;root.add(leaves);}
 else if(type==='stairs'){for(let i=0;i<14;i++){const step=h*(i+1)/14;box(w,step,d/14,w/2,step/2,d-(i+.5)*d/14,wood);}}
 else if(type==='cabinet'){box(w,h,d,w/2,h/2,d/2,white);box(w+.02,.04,d+.02,w/2,h+.02,d/2,wood);}
 else if(type==='rug')box(w,.008,d,w/2,.008,d/2,fabric);
 else if(type==='tub'||type==='basin'||type==='sink'){box(w,h*.9,d,w/2,h*.45,d/2,white);box(w*.75,.015,d*.74,w/2,h*.91,d/2,mat(0xcbd9de));}
 else if(type==='hob'){box(w,.025,d,w/2,h,d/2,metal);}
 else if(type==='toilet'){box(w*.65,h*.7,d*.7,w/2,h*.35,d*.6,white);box(w,h*.3,d*.9,w/2,h*.85,d*.53,white);}
 else if(type==='washer'){box(w,h,d,w/2,h/2,d/2,white);box(w*.6,h*.6,.025,w/2,h*.47,d+.013,metal);}
 else box(w,h,d,w/2,h/2,d/2,wood);
 // Materials that were not used by this item should not remain allocated.
 const used=new Set();root.traverse(o=>{if(o.material)used.add(o.material);});for(const m of [wood,fabric,white,metal])if(!used.has(m)&&m!==selectedMaterial)m.dispose();
 return root;
}
