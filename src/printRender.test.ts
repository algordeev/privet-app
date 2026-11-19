import test from 'node:test';
import assert from 'node:assert/strict';
import {fillStressed} from './printRender.ts';
// A canvas stand-in: every character is 10 px wide; records text and accent strokes.
function fakeContext(){
 const calls:{text:string;x:number;y:number}[]=[],strokes:number[][]=[];let path:number[]=[];
 const ctx={font:'700 20px system-ui',textAlign:'left' as CanvasTextAlign,fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'butt',
  measureText:(text:string)=>({width:[...text].length*10}),fillText:(text:string,x:number,y:number)=>calls.push({text,x,y}),
  save(){},restore(){},setLineDash(){},beginPath(){path=[];},moveTo(x:number,y:number){path.push(x,y);},lineTo(x:number,y:number){path.push(x,y);},stroke(){strokes.push(path);}};
 return {ctx:ctx as unknown as CanvasRenderingContext2D,calls,strokes};
}
test('stress marks: the text is drawn without U+0301 and the accent is stroked above its vowel',()=>{
 const {ctx,calls,strokes}=fakeContext();
 fillStressed(ctx,'ко́фе',100,50);
 assert.deepEqual(calls,[{text:'кофе',x:100,y:50}]);
 assert.equal(strokes.length,1);
 const [x1,y1,x2,y2]=strokes[0];
 // The о is the second letter: x 110–120, centre 115. The stroke rises to the right above the x-height.
 assert.ok(Math.abs((x1+x2)/2-115)<3,String([x1,x2]));
 assert.ok(y1<50-20*0.54&&y2<y1);
});
test('stress marks follow centred text and capitals, and plain text draws no accent',()=>{
 const centred=fakeContext();centred.ctx.textAlign='center';
 fillStressed(centred.ctx,'Я́',100,50);
 assert.deepEqual(centred.calls,[{text:'Я',x:95,y:50}]);
 assert.equal(centred.ctx.textAlign,'center');
 const [,y1]=centred.strokes[0];assert.ok(y1<50-20*0.73);
 const plain=fakeContext();fillStressed(plain.ctx,'чай',0,10);assert.equal(plain.strokes.length,0);
 const two=fakeContext();fillStressed(two.ctx,'Приве́т! Спаси́бо!',0,10);assert.equal(two.strokes.length,2);
});
