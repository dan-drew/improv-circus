import {test} from 'node:test';
import assert from 'node:assert/strict';
import {timeline,chapters,overlayGeometry} from './prepare.mjs';
test('wrap up ends games while stop video retains outro without adding chapters',()=>{
  const spec={start:'05:08',wrapUp:'05:30',stopVideo:'05:45',segments:[{time:'05:08',name:'Opening'},{time:'05:12',name:'Game',titled:true}]};
  const t=timeline(spec,400);
  assert.equal(t.duration,37);assert.equal(t.wrapUp,22);assert.equal(t.segments[1].end,22);
  assert.doesNotMatch(chapters(t).text,/wrap|stop/i);
  for(const wrapUp of ['05:07','05:11','05:46']) assert.throws(()=>timeline({...spec,wrapUp},400));
  assert.throws(()=>timeline({...spec,end:'05:44'},400),/disagree/);
  assert.equal(timeline({...spec,end:spec.stopVideo},400).duration,37);
  const {stopVideo,wrapUp,...legacy}=spec;
  assert.equal(timeline({...legacy,end:stopVideo},400).segments[1].end,37);
  const joined=timeline({start:'00:00',wrapUp:'1:09:38.8',stopVideo:'1:11:14.814646',segments:[{time:'00:00',name:'Opening'},{time:'1:03:41.8',name:'185',titled:true}]},4274.814646);
  assert.equal(joined.segments[1].end,4178.8);assert.equal(joined.duration,4274.814646);
});
test('cropping insets the positioned full image without rescaling the remainder',()=>{
  const rect={x:615.12,y:67.38,width:722.29,height:406.48,crop:{left:3.7559,top:3.1921,right:5.7566,bottom:6.3003}};
  assert.deepEqual(overlayGeometry(rect),{x:642,y:80,width:654,height:368,resizeWidth:722,resizeHeight:406,cropX:27,cropY:13});
  for(const crop of [{left:101},{left:50,right:50},{top:-1}]) assert.throws(()=>overlayGeometry({...rect,crop}));
  assert.throws(()=>overlayGeometry({...rect,x:1900}));
});
