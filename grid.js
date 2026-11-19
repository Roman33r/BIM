export const validGridStep=value=>typeof value==='number'&&Number.isFinite(value)&&value>=.01&&value<=100;
export function snapToGrid(point,step){
 return {x:Math.round(point.x/step)*step,y:Math.round(point.y/step)*step};
}
