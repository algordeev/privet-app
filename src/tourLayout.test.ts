import test from 'node:test';
import assert from 'node:assert/strict';
import {tourLayout} from './tourLayout.ts';
const viewport={left:0,top:44,width:375,height:589};
test('tour uses measured height and fits below the header',()=>{
 const p=tourLayout({left:270,top:65,width:44,height:44},viewport,240);
 assert.equal(p.below,true);assert.equal(p.height,240);assert.equal(p.top,139);assert.equal(p.left,59);
});
test('tour fits above a low target without assuming a fixed card height',()=>{
 const p=tourLayout({left:30,top:520,width:200,height:60},viewport,270);
 assert.equal(p.below,false);assert.equal(p.top,220);assert.equal(p.height,270);
});
test('large-text cards are bounded and can scroll in the available safe viewport',()=>{
 const p=tourLayout({left:20,top:220,width:44,height:44},viewport,900);
 assert.equal(p.height,557);assert.equal(p.maxHeight,557);assert.equal(p.top,60);assert.equal(p.arrowVisible,false);
});
test('tour stays within small and large iPhone viewports with offsets',()=>{
 for(const v of [{left:0,top:44,width:320,height:490},{left:12,top:59,width:430,height:839}])for(const h of [140,250,1200]){
  const p=tourLayout({left:290,top:300,width:44,height:44},v,h);
  assert.ok(p.left>=v.left+16);assert.ok(p.left+p.width<=v.left+v.width-16);
  assert.ok(p.top>=v.top+16);assert.ok(p.top+p.height<=v.top+v.height-16);
 }
});
