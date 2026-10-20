import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seconds,timeline,resolveShow,chapters,wipeWidth } from './prepare.mjs';
test('source timecodes, trim offsets and title exclusions',()=>{
  assert.equal(seconds('1:02:03.5'),3723.5);
  for(const invalid of ['1:60','1:60:00','-1:00','bad']) assert.throws(()=>seconds(invalid));
  const t=timeline({start:'01:00',end:'01:30',segments:[{time:'01:00',name:'Opening'},{time:'01:03',name:"New Choice: it's $fun!"},{time:'01:20',name:'Closing'}]},100);
  assert.deepEqual(t.segments.map(s=>s.titled),[false,true,false]);
  assert.equal(t.segments[1].time,3); assert.equal(t.segments[1].end,20);
  assert.match(chapters(t).text,/0:03 New Choice/);
  assert.ok(chapters(t).warnings.length);
  assert.throws(()=>timeline({start:'00:00',end:'00:20',segments:[{time:'00:01',name:'a'},{time:'00:01',name:'b'}]},30));
  assert.throws(()=>timeline({start:'00:00',end:'00:20',segments:[{time:'00:00',name:'a'},{time:'00:02',name:'b'},{time:'00:04',name:'c'}]},30));
});
test('show defaults, nullish overrides, slug and ambiguity',()=>{
  const records={shows:[{type:'test',when:{date:'2026-09-19'},name:null,players:['p'],guest_players:['g']}],types:{test:{name:'Default',slug:'wry_vs_dry',theater:'venue'}},theaters:{venue:{name:'Theater'}},players:{p:{name:'Player'},g:{name:'Guest'}}};
  const show=resolveShow({date:'2026-09-19'},records);
  assert.equal(show.name,'Default');assert.equal(show.slug,'wry-vs-dry-2026-09-19');assert.deepEqual(show.guests,['Guest']);
  records.shows.push({...records.shows[0],slug:'special-2026-09-19'});
  assert.throws(()=>resolveShow({date:'2026-09-19'},records));
  assert.equal(resolveShow({date:'2026-09-19',showSlug:'special-2026-09-19'},records).slug,'special-2026-09-19');
});
test('wipe reveals and conceals the right edge at half-second boundaries',()=>{
  assert.equal(wipeWidth(0,8),0);assert.equal(wipeWidth(.25,8),.5);assert.equal(wipeWidth(.5,8),1);
  assert.equal(wipeWidth(7.5,8),1);assert.equal(wipeWidth(7.75,8),.5);assert.equal(wipeWidth(8,8),0);
});

test('synthetic recording: preview, render, frame rate, padding, wipes and overwrite protection', {skip:!process.env.SHOW_VIDEO_TEST, timeout:240000}, async()=>{
  const fs=await import('node:fs'), path=await import('node:path');
  const {spawnSync}=await import('node:child_process');
  const testRoot=path.join(process.env.SHOW_PROJECT_ROOT??process.cwd(),'tmp');
  fs.mkdirSync(testRoot,{recursive:true});
  const dir=fs.mkdtempSync(path.join(testRoot,"show's video $test-"));
  const root=process.env.SHOW_PROJECT_ROOT??process.cwd();
  const helper=new URL('./prepare.mjs',import.meta.url).pathname;
  const call=(cmd,args)=>{
    const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024});
    assert.equal(r.status,0,`${cmd}: ${r.stderr}\n${r.stdout}`); return r.stdout;
  };
  try {
    const source=path.join(dir,'original recording.mp4'), spec=path.join(dir,'spec.json');
    call('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0x203040:size=640x480:rate=12:duration=12','-f','lavfi','-i','sine=frequency=440:duration=12','-c:v','libx264','-preset','ultrafast','-c:a','aac','-shortest',source]);
    const original=fs.statSync(source);
    fs.writeFileSync(spec,JSON.stringify({date:'2026-09-19',source,introAudio:{source,fadeComplete:'00:02.5'},tempDirectory:dir,start:'00:01',wrapUp:'00:10',stopVideo:'00:11',summary:'Recorded competitive improv comedy.',segments:[{time:'00:01',name:'Opening'},{time:'00:02',name:"New Choice: it's $fun!"},{time:'00:10',name:'Closing'}]}));
    call('node',[helper,'--root',root,'--spec',spec,'--mode','validate']);
    call('node',[helper,'--root',root,'--spec',spec,'--mode','preview']);
    call('node',[helper,'--root',root,'--spec',spec,'--mode','render']);
    const output=path.join(dir,'wry-vs-dry-2026-09-19','improv-circus-wry-vs-dry-2026-09-19.mp4');
    const result=JSON.parse(call('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output]));
    const v=result.streams.find(s=>s.codec_type==='video'), a=result.streams.find(s=>s.codec_type==='audio');
    assert.equal(v.width,1920);assert.equal(v.height,1080);assert.equal(v.avg_frame_rate,'12/1');
    assert.match(result.format.tags.title,/Wry vs. Dry/);assert.equal(result.format.tags.date,'2026-09-19');assert.match(result.format.tags.comment,/2550 Telegraph Avenue, Oakland, CA 94612/);assert.match(result.format.tags.comment,/Featuring:/);assert.equal(result.format.tags.location_address,undefined);assert.match(result.format.tags.description,/0:01 New Choice/);
    assert.equal(v.nb_frames,'120');assert.equal(a.codec_name,'aac');assert.ok(Math.abs(Number(result.format.duration)-10)<.1);
    const yellow=time=>{
      const r=spawnSync('ffmpeg',['-v','error','-ss',String(time),'-i',output,'-frames:v','1','-vf','crop=680:120:400:900','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:2*1024*1024});
      assert.equal(r.status,0);let n=0;for(let i=0;i<r.stdout.length;i+=3) if(r.stdout[i]>170 && r.stdout[i+1]>160 && r.stdout[i+2]<100)n++;return n;
    };
    const full=yellow(1.75), half=yellow(1.25), gone=yellow(4.75);
    assert.ok(full>1000);assert.ok(half>100 && half<full*.9);assert.ok(gone<20);assert.ok(yellow(0)>1000);assert.ok(yellow(9.25)>1000);
    const black=spawnSync('ffmpeg',['-v','error','-ss','1','-i',output,'-frames:v','1','-vf','crop=2:2:10:200','-f','rawvideo','-pix_fmt','rgb24','-']);
    assert.equal(black.status,0);assert.ok([...black.stdout].every(n=>n<10));
    const copy=fs.readFileSync(output.replace(/\.mp4$/,'-youtube-description.txt'),'utf8');
    assert.match(copy,/0:00 Opening\n0:01 New Choice: it's \$fun!\n0:09 Closing/);assert.match(copy,/Recorded competitive improv comedy/);
    const repeated=spawnSync('node',[helper,'--root',root,'--spec',spec,'--mode','render'],{encoding:'utf8'});
    assert.notEqual(repeated.status,0);assert.match(repeated.stderr,/Output exists/);
    assert.equal(fs.statSync(source).size,original.size);assert.equal(fs.statSync(source).mtimeMs,original.mtimeMs);
    const joinedDir=path.join(dir,'joined'); fs.mkdirSync(joinedDir);
    const joinedSource=path.join(joinedDir,'source.mp4'); fs.symlinkSync(source,joinedSource);
    const patch=path.join(joinedDir,'patch.png');
    call('convert',['-size','200x100','xc:lime','-fill','red','-draw','rectangle 20,10 159,79',patch]);
    const joinedSpec=path.join(joinedDir,'spec.json');
    fs.writeFileSync(joinedSpec,JSON.stringify({date:'2026-09-19',source:joinedSource,introAudio:{source:joinedSource,fadeComplete:'00:02.5'},tempDirectory:joinedDir,outputDirectory:path.join(joinedDir,'wry-vs-dry-2026-09-19'),sources:[{source:joinedSource,start:'00:01',end:'00:03'},{source:joinedSource,start:'00:01',end:'00:10'}],start:'00:00',wrapUp:'00:08',stopVideo:'00:10.8',sourceOverlays:[{sourceIndex:0,sourceStart:'00:01.5',image:patch,x:100,y:100,width:200,height:100,crop:{left:10,right:20,top:10,bottom:20}}],previewDuration:3,segments:[{time:'00:00',name:'Opening'},{time:'00:02',name:'Four-Headed Opera Singer',titled:true}]}));
    call('node',[helper,'--root',root,'--spec',joinedSpec,'--mode','preview']);
    call('node',[helper,'--root',root,'--spec',joinedSpec,'--mode','render']);
    const joinedOutput=path.join(joinedDir,'wry-vs-dry-2026-09-19','improv-circus-wry-vs-dry-2026-09-19.mp4');
    const joined=JSON.parse(call('ffprobe',['-v','error','-show_streams','-show_format','-of','json',joinedOutput]));
    assert.equal(joined.streams.find(s=>s.codec_type==='video').avg_frame_rate,'30/1');
    assert.ok(Math.abs(Number(joined.format.duration)-10.8)<0.1);
    assert.equal(joined.streams.find(s=>s.codec_type==='video').nb_frames,'324');
    const preview=JSON.parse(call('ffprobe',['-v','error','-show_format','-of','json',path.join(joinedDir,'improv-circus-wry-vs-dry-2026-09-19-preview/preview.mp4')]));
    assert.ok(Math.abs(Number(preview.format.duration)-3)<0.1);
    const rgb=(time,x=150,y=130)=>{
      const r=spawnSync('ffmpeg',['-v','error','-ss',String(time),'-i',joinedOutput,'-frames:v','1','-vf',`crop=2:2:${x}:${y}`,'-f','rawvideo','-pix_fmt','rgb24','-']);
      assert.equal(r.status,0,r.stderr?.toString());return [...r.stdout.subarray(0,3)];
    };
    assert.ok(rgb(.25)[0]<15,'patch absent before source-relative start');
    assert.ok(rgb(.6)[0]>200,'patch appears after mapped start');
    assert.ok(rgb(1)[0]>200,'patch remains before crossfade');
    const fade=rgb(1.9)[0];assert.ok(fade>40 && fade<200,'patch crossfades with first source');
    assert.ok(rgb(2.1)[0]<15,'patch absent after first source');
    assert.ok(rgb(1,110,130)[0]<15,'crop insets left edge instead of stretching');
    const joinedYellow=time=>{
      const r=spawnSync('ffmpeg',['-v','error','-ss',String(time),'-i',joinedOutput,'-frames:v','1','-vf','crop=680:120:400:900','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:2*1024*1024});
      assert.equal(r.status,0);let n=0;for(let i=0;i<r.stdout.length;i+=3)if(r.stdout[i]>170 && r.stdout[i+1]>160 && r.stdout[i+2]<100)n++;return n;
    };
    assert.ok(joinedYellow(7)<20,'website does not appear before wrap up');
    assert.ok(joinedYellow(8.5)>1000,'website appears at wrap up');
    assert.ok(joinedYellow(10.5)>1000,'website remains throughout retained outro');


  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
