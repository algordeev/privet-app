export type TourRect={left:number;top:number;width:number;height:number};
export function tourLayout(target:TourRect,viewport:TourRect,measuredHeight:number){
 const margin=16,gap=30,width=Math.max(0,Math.min(300,viewport.width-margin*2));
 const minX=viewport.left+margin,minY=viewport.top+margin;
 const maxHeight=Math.max(0,viewport.height-margin*2),height=Math.min(Math.max(0,measuredHeight),maxHeight);
 const bottom=viewport.top+viewport.height-margin;
 const belowRoom=bottom-(target.top+target.height+gap),aboveRoom=target.top-gap-minY;
 const below=belowRoom>=height||(aboveRoom<height&&belowRoom>=aboveRoom);
 const desired=below?target.top+target.height+gap:target.top-gap-height;
 const top=Math.max(minY,Math.min(desired,bottom-height));
 const left=Math.max(minX,Math.min(target.left,viewport.left+viewport.width-margin-width));
 const arrowVisible=top>=target.top+target.height||top+height<=target.top;
 return {width,height,maxHeight,top,left,below,arrowVisible};
}
