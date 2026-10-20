import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { organizeRecording,checksum,publishFiles,showDirectory,recordingSlug } from './media-files.mjs';
import { candidatePlan,frameMetrics,nearDuplicate,sampleHighlights,exportHighlights } from './highlights.mjs';

const testRoot=path.join(process.env.SHOW_PROJECT_ROOT??process.cwd(),'tmp');
fs.mkdirSync(testRoot,{recursive:true});

test('organize originals and recognized deliverables, repair links, retain extensions and checksums',async()=>{
  const dir=fs.mkdtempSync(path.join(testRoot,'show-organize-'));
  try {
    const slug='example-2026-10-17',inputs=path.join(dir,'videos'),temp=path.join(dir,'temp');
    fs.mkdirSync(inputs);fs.mkdirSync(temp);
    const originals=['a.MOV','b.mp4'].map((name,i)=>{const file=path.join(inputs,name);fs.writeFileSync(file,`original ${i}`);return file;});
    const hashes=await Promise.all(originals.map(checksum));
    originals.forEach((file,i)=>fs.symlinkSync(file,path.join(temp,`part${i+1}.mp4`)));
    const names=[`improv-circus-${slug}.mp4`,`improv-circus-${slug}-youtube-description.txt`,`improv-circus-${slug}-two-minute-review-v4.mp4`];
    for(const name of [...names,'another-show.mp4','notes.txt']) fs.writeFileSync(path.join(inputs,name),name);
    const specFile=path.join(temp,'recording.json');
    fs.writeFileSync(specFile,JSON.stringify({source:'part2.mp4',sources:[{source:'part1.mp4',start:'00:01',end:'00:02'},{source:'part2.mp4',start:'00:00',end:'00:10'}]}));
    const result=await organizeRecording(specFile,slug);
    assert.deepEqual(result.originals.map(file=>path.basename(file)),[`${slug}-original-1.MOV`,`${slug}-original-2.mp4`]);
    assert.deepEqual(await Promise.all(result.originals.map(checksum)),hashes);
    for(const file of originals) assert.equal(fs.existsSync(file),false);
    for(const name of names) {assert.equal(fs.existsSync(path.join(inputs,name)),false);assert.ok(fs.existsSync(path.join(result.directory,name)));}
    assert.ok(fs.existsSync(path.join(inputs,'another-show.mp4')));assert.ok(fs.existsSync(path.join(inputs,'notes.txt')));
    assert.equal(fs.realpathSync(path.join(temp,'part1.mp4')),result.originals[0]);
    const updated=JSON.parse(fs.readFileSync(specFile));
    assert.equal(updated.source,result.originals[1]);assert.equal(updated.sources[0].source,result.originals[0]);
    assert.equal(updated.outputDirectory,result.directory);
    assert.deepEqual((await organizeRecording(specFile,slug)).moved,[]);
    assert.equal(showDirectory(slug,result.originals,undefined,temp),result.directory);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('single-source naming and collision preflight prevent partial moves',async()=>{
  assert.equal(recordingSlug('custom','2026-10-17'),'custom-2026-10-17');
  assert.equal(recordingSlug('custom-2026-10-17','2026-10-17'),'custom-2026-10-17');
  const dir=fs.mkdtempSync(path.join(testRoot,'show-single-'));
  try {
    const source=path.join(dir,'recording.mkv'),spec=path.join(dir,'recording.json'),slug='show-2026-10-17';
    fs.writeFileSync(source,'original');fs.writeFileSync(spec,JSON.stringify({source}));
    const target=path.join(dir,slug,`${slug}-original.mkv`);fs.mkdirSync(path.dirname(target));fs.writeFileSync(target,'existing');
    await assert.rejects(organizeRecording(spec,slug),/Destination exists/);
    assert.equal(fs.readFileSync(source,'utf8'),'original');assert.equal(fs.readFileSync(target,'utf8'),'existing');
    fs.unlinkSync(target);assert.deepEqual((await organizeRecording(spec,slug)).originals,[target]);
    const incoming=path.join(dir,'new.txt');fs.writeFileSync(incoming,'new');
    await assert.rejects(publishFiles([[incoming,path.join(dir,'new-output')],[incoming,target]]),/Output exists/);
    assert.equal(fs.existsSync(path.join(dir,'new-output')),false);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('highlight candidates map trim offsets and avoid joined-video overlap',()=>{
  const t={start:30,duration:20,segments:[{name:'Opening',time:0,end:2,titled:false},{name:'Game',time:2,end:18,titled:true},{name:'Closing',time:18,end:20,titled:false}]};
  const single=candidatePlan(t,'source.mp4');assert.equal(single.length,1);
  for(const c of single[0].candidates) assert.equal(c.sourceTime,30+c.time);
  assert.equal(candidatePlan(t,'source.mp4',true).length,3);
  const joined=candidatePlan({...t,start:0},[{source:'p1',start:308,end:318,at:0,fade:.2},{source:'p2',start:10,end:20.2,at:9.8,fade:.2}]);
  for(const c of joined[0].candidates) {
    assert.ok(c.time<9.8 || c.time>=10);
    assert.ok(Math.abs(c.sourceTime-(c.sourceIndex===1?308+c.time:10+c.time-9.8))<1e-8);
  }
  const black=Buffer.alloc(160*90),same=Buffer.alloc(160*90),white=Buffer.alloc(160*90,255);
  assert.equal(frameMetrics(black).darkFraction,1);assert.equal(frameMetrics(white).brightFraction,1);
  assert.ok(nearDuplicate(black,same));assert.equal(nearDuplicate(black,white),false);
});
test('deferred organizer acts only after successful render publication', {skip:!process.env.SHOW_VIDEO_TEST},()=>{
  const dir=fs.mkdtempSync(path.join(testRoot,'show-deferred-'));
  try {
    const source=path.join(dir,'source.mp4'),spec=path.join(dir,'spec.json'),status=path.join(dir,'full-render-status.json');
    fs.writeFileSync(source,'untouched original');fs.writeFileSync(spec,JSON.stringify({date:'2026-09-19',source}));
    const args=[new URL('./organize-after-job.mjs',import.meta.url).pathname,'--job',dir,'--spec',spec,'--root',process.env.SHOW_PROJECT_ROOT??process.cwd()];
    fs.writeFileSync(status,JSON.stringify({stage:'failed'}));
    assert.notEqual(spawnSync(process.execPath,args,{encoding:'utf8'}).status,0);assert.ok(fs.existsSync(source));
    fs.writeFileSync(status,JSON.stringify({stage:'complete'}));
    const result=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
    assert.equal(fs.existsSync(source),false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'organization-status.json'))).stage,'complete');
    assert.equal(fs.readFileSync(path.join(dir,'wry-vs-dry-2026-09-19','wry-vs-dry-2026-09-19-original.mp4'),'utf8'),'untouched original');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('synthetic highlights: candidates, final source-resolution stills, labels and no overwrites', {skip:!process.env.SHOW_VIDEO_TEST,timeout:120000},async()=>{
  const dir=fs.mkdtempSync(path.join(testRoot,'show-highlights-'));
  const call=(command,args)=>{const r=spawnSync(command,args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
  try {
    const source=path.join(dir,'source.mp4'),out=path.join(dir,'videos','show-2026-10-17'),candidates=path.join(dir,'candidates');
    call('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=12:duration=8','-c:v','libx264','-preset','ultrafast',source]);
    const context={slug:'show-2026-10-17',timeline:{start:0,duration:8,segments:[{name:'Game? $fun',time:0,end:8,titled:true}]},media:source,outputDirectory:out};
    const manifest=sampleHighlights(context,candidates);
    const segment=manifest.segments[0],usable=segment.candidates.filter(c=>!c.rejected);
    assert.ok(usable.length>=5);assert.ok(segment.contactSheets.length);assert.equal(fs.existsSync(out),false);
    assert.throws(()=>sampleHighlights(context,candidates),/already exists/);
    const retained=segment.candidates[0].file,mtime=fs.statSync(retained).mtimeMs;
    fs.unlinkSync(segment.candidates[1].file);
    assert.equal(sampleHighlights(context,candidates,true).complete,true);
    assert.equal(fs.statSync(retained).mtimeMs,mtime);assert.ok(fs.existsSync(segment.candidates[1].file));
    assert.throws(()=>sampleHighlights({...context,outputDirectory:out+'-changed'},candidates,true),/settings changed/);
    const selection=path.join(dir,'selection.json');fs.writeFileSync(selection,JSON.stringify({segments:[{segmentIndex:0,candidates:usable.slice(0,5).map(c=>c.id)}]}));
    const work=path.join(dir,'exports');fs.mkdirSync(work);
    const outputs=await exportHighlights(path.join(candidates,'candidates.json'),selection,work);
    assert.equal(outputs.length,6);
    for(const {file,sha256} of outputs) {assert.equal(await checksum(file),sha256);assert.ok(file.startsWith(out+path.sep));}
    const still=outputs.find(o=>!o.file.includes('contact-sheet')).file;
    assert.equal(call('identify',['-format','%w %h',still]),'320 180');
    assert.match(path.basename(still),/game-fun-highlight-p1-\d{2}-\d{2}-\d{2}-\d{3}\.jpg/);
    const again=path.join(dir,'again');fs.mkdirSync(again);
    await assert.rejects(exportHighlights(path.join(candidates,'candidates.json'),selection,again),/Output exists/);
    fs.writeFileSync(selection,JSON.stringify({segments:[{segmentIndex:0,candidates:usable.slice(0,2).map(c=>c.id)}]}));
    await assert.rejects(exportHighlights(path.join(candidates,'candidates.json'),selection,again),/Explain fewer/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
