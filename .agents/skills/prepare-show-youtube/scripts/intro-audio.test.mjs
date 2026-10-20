import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {introTiming,introAudioFilters} from './prepare.mjs';
test('intro source timestamps map to trimmed timeline and require complete valid timing',()=>{
  const spec={introAudio:{source:'music.mp4',fadeComplete:'05:19'}};
  assert.deepEqual(introTiming(spec,{start:308,duration:100},'video.mp4'),{complete:11});
  assert.deepEqual(introTiming(spec,{start:0,duration:200},[{start:308,end:401,fade:.2}]),{complete:11});
  assert.equal(introTiming({}, {start:0,duration:100},'video.mp4'),null);
  for(const fadeComplete of [undefined,'05:08.2','07:00']) assert.throws(()=>introTiming({introAudio:{source:'music.mp4',fadeComplete}},{start:308,duration:100},'video.mp4'));
});
test('intro mix mutes source, linearly crossfades, restores source and handles preview offsets',()=>{
  const root=path.resolve(process.env.SHOW_PROJECT_ROOT??process.cwd(),'tmp');fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'intro-audio-test-'));
  try {
    for(const offset of [0,1.75,2.5]) {
      const target=path.join(dir,`mix-${offset}.f32`);
      const active=offset<2;
      const filters=active?introAudioFilters('0:a','1:a',2,offset):['[0:a]anull[a]'];
      const args=['-v','error','-f','lavfi','-i','aevalsrc=0.2|0.2:s=48000:d=3','-f','lavfi','-i','aevalsrc=0.4|0.4:s=48000:d=3','-filter_complex',filters.join(';'),'-map','[a]','-t','3','-f','f32le',target];
      const r=spawnSync('ffmpeg',args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
      const data=fs.readFileSync(target),channels=2;
      const sample=t=>data.readFloatLE(Math.round(t*48000)*channels*4);
      if(offset===0) {assert.ok(Math.abs(sample(.5)-.4)<.005);assert.ok(Math.abs(sample(1.75)-.3)<.005);assert.ok(Math.abs(sample(2.5)-.2)<.005);}
      if(offset===1.75) {assert.ok(Math.abs(sample(.05)-.28)<.005);assert.ok(Math.abs(sample(.5)-.2)<.005);}
      if(offset===2.5) assert.ok(Math.abs(sample(.5)-.2)<.005);
    }
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
