import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checksum,publishFiles } from './media-files.mjs';

const insist=(ok,message)=>{if(!ok) throw new Error(message);};
function run(cmd,args,binary=false) {
  const result=spawnSync(cmd,args,{encoding:binary?undefined:'utf8',maxBuffer:32*1024*1024});
  insist(!result.error && result.status===0,`${cmd}: ${result.error?.message??result.stderr}`);
  return result.stdout;
}
export function timeLabel(seconds) {
  const millis=Math.round(seconds*1000),s=Math.floor(millis/1000);
  return `${String(Math.floor(s/3600)).padStart(2,'0')}-${String(Math.floor(s/60)%60).padStart(2,'0')}-${String(s%60).padStart(2,'0')}-${String(millis%1000).padStart(3,'0')}`;
}
const safeName=name=>name.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'segment';
export function frameMetrics(pixels,width=160,height=90) {
  insist(pixels.length===width*height,'Invalid grayscale frame');
  let sum=0,dark=0,bright=0,lap=0,lap2=0,n=0;
  for(const p of pixels) {sum+=p;if(p<12) dark++;if(p>245) bright++;}
  for(let y=1;y<height-1;y++) for(let x=1;x<width-1;x++) {
    const i=y*width+x,v=4*pixels[i]-pixels[i-1]-pixels[i+1]-pixels[i-width]-pixels[i+width];
    lap+=v;lap2+=v*v;n++;
  }
  const sharpness=lap2/n-(lap/n)**2;
  return {brightness:sum/pixels.length,darkFraction:dark/pixels.length,brightFraction:bright/pixels.length,sharpness};
}
export function nearDuplicate(a,b) {
  let sum=0,changed=0;
  for(let i=0;i<a.length;i++) {const d=Math.abs(a[i]-b[i]);sum+=d;if(d>12) changed++;}
  return sum/a.length<1.5 && changed/a.length<0.015;
}
export function candidatePlan(t,media,includeEdges=false) {
  const parts=Array.isArray(media)?media:[{source:media,start:t.start,end:t.start+t.duration,at:0,fade:0}];
  const plans=[];
  for(const [segmentIndex,s] of t.segments.entries()) {
    if(!includeEdges && !s.titled) continue;
    const margin=Math.min(3,(s.end-s.time)*0.1), ranges=[];
    parts.forEach((p,i)=>{
      // Overlap frames are blends in the final video; sample neither side there.
      const low=Math.max(s.time+margin,p.at+(i?p.fade:0));
      const high=Math.min(s.end-margin,parts[i+1]?.at??p.at+p.end-p.start);
      if(high>low) ranges.push({low,high,part:p,index:i});
    });
    const length=ranges.reduce((sum,r)=>sum+r.high-r.low,0);
    if(!length) {plans.push({segmentIndex,name:s.name,candidates:[]});continue;}
    const count=Math.min(60,Math.max(30,Math.ceil(length/8)),Math.max(1,Math.floor(length*2)));
    const candidates=[];
    for(let i=0;i<count;i++) {
      let offset=(i+.5)*length/count;
      for(const r of ranges) {
        if(offset<r.high-r.low) {
          const time=r.low+offset;
          candidates.push({id:`s${String(segmentIndex+1).padStart(2,'0')}-c${String(i+1).padStart(2,'0')}`,time,source:r.part.source,sourceIndex:r.index+1,sourceTime:r.part.start+time-r.part.at});break;
        }
        offset-=r.high-r.low;
      }
    }
    plans.push({segmentIndex,name:s.name,start:s.time,end:s.end,candidates});
  }
  return plans;
}
function sheet(candidates,target,title,columns=5) {
  const dir=fs.mkdtempSync(path.join(path.dirname(target),'.sheet-'));
  try {
    const tiles=candidates.map((c,i)=>{
      const tile=path.join(dir,`${i}.jpg`);
      run('convert',[c.file,'-thumbnail','240x150','-background','#202020','-gravity','center','-extent','240x150',
        '(','-background','#202020','-fill','white','-font','DejaVu-Sans','-pointsize','12',
        `label:${c.id} | p${c.sourceIndex} ${timeLabel(c.sourceTime).replace(/^(\d+)-(\d+)-(\d+)-(\d+)$/,'$1:$2:$3.$4')}`,')','-append',tile]);return tile;
    });
    const grid=path.join(dir,'grid.jpg');
    run('montage',[...tiles,'-tile',`${columns}x`,'-geometry','+3+3','-background','#202020',grid]);
    const escaped=title.replaceAll('\\','\\\\').replaceAll('%','%%').replace(/^@/,'\\@');
    run('convert',['-background','#202020','-fill','white','-font','DejaVu-Sans','-pointsize','22','-size',`${columns*246}x`,
      `caption:${escaped}`,grid,'-append','-quality','90',target]);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
export function samplingSnapshot(context) {
  const segments=candidatePlan(context.timeline,context.media,context.includeEdges);
  const sources=[...new Set(segments.flatMap(s=>s.candidates.map(c=>c.source)))].map(file=>{
    const stat=fs.statSync(file);return {file,size:stat.size,mtimeMs:stat.mtimeMs};
  });
  return {slug:context.slug,outputDirectory:context.outputDirectory,segments,sources};
}
export function sampleHighlights(context,directory,resume=false) {
  const snapshot=samplingSnapshot(context), snapshotFile=path.join(directory,'sampling.json');
  if(fs.existsSync(directory)) {
    insist(resume,`Highlight work already exists: ${directory}; use --resume for an interrupted sample`);
    insist(fs.readFileSync(snapshotFile,'utf8')===JSON.stringify(snapshot,null,2)+'\n','Recording inputs or sampling settings changed; use a new candidate directory');
  } else {
    insist(!resume,'Cannot resume a missing candidate directory');
    fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(snapshotFile,JSON.stringify(snapshot,null,2)+'\n');
  }
  const manifest={version:1,complete:false,slug:context.slug,outputDirectory:context.outputDirectory,segments:snapshot.segments};
  const manifestFile=path.join(directory,'candidates.json');
  const checkpoint=()=>fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  checkpoint();
  for(const segment of manifest.segments) {
    console.log(`Sampling highlights: ${segment.name}`);
    const grays=[];
    for(const c of segment.candidates) {
      c.file=path.join(directory,`${c.id}.jpg`);
      if(fs.existsSync(c.file) && resume && fs.statSync(c.file).size===0) fs.unlinkSync(c.file);
      if(!resume || !fs.existsSync(c.file)) run('ffmpeg',['-v','error','-nostdin','-threads','1','-ss',String(c.sourceTime),'-i',c.source,'-frames:v','1','-vf','scale=640:-2','-threads','1','-q:v','3','-n',c.file]);
      const gray=run('convert',[c.file,'-colorspace','gray','-resize','160x90!','-depth','8','gray:-'],true);
      c.metrics=frameMetrics(gray);
      const m=c.metrics;
      if(m.brightness<18 || m.darkFraction>.97) c.rejected='too dark';
      else if(m.brightness>240 || m.brightFraction>.97) c.rejected='overexposed';
      else if(m.sharpness<4) c.rejected='no usable detail';
      else if(grays.some(g=>nearDuplicate(gray,g))) c.rejected='near duplicate';
      else grays.push(gray);
      if(Number(c.id.slice(-2))%10===0) console.log(`${segment.name}: ${Number(c.id.slice(-2))}/${segment.candidates.length} candidates`);
    }
    // A conservative absolute blur threshold avoids rejecting an entire dim stage.
    const usable=segment.candidates.filter(c=>!c.rejected);
    if(usable.length>=10) {
      const sorted=usable.map(c=>c.metrics.sharpness).sort((a,b)=>a-b), floor=sorted[Math.floor(sorted.length/2)]*.15;
      for(const c of usable) if(c.metrics.sharpness<floor) c.rejected='motion blur';
    }
    const review=segment.candidates.filter(c=>!c.rejected);segment.contactSheets=[];
    for(let i=0;i<review.length;i+=30) {
      const target=path.join(directory,`segment-${segment.segmentIndex+1}-candidates-${Math.floor(i/30)+1}.jpg`);
      sheet(review.slice(i,i+30),target,`${segment.name} — candidates ${i+1}–${Math.min(i+30,review.length)}`);
      segment.contactSheets.push(target);
    }
    checkpoint();
  }
  manifest.complete=true;checkpoint();
  console.log(`Review the contact sheets, then supply a selection JSON: ${manifestFile}`);
  return manifest;
}
export async function exportHighlights(manifestFile,selectionFile,work,replace=false) {
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8')), selection=JSON.parse(fs.readFileSync(selectionFile,'utf8'));
  insist(manifest.complete===true,'Candidate sampling must complete before exporting selections');
  insist(selection && Array.isArray(selection.segments),'Selection requires a segments array');
  insist(selection.segments.length===manifest.segments.length,'Review every sampled segment, including those with no usable frames');
  const used=new Set(),prepared=[];
  // Validate all selections before decoding or publishing any deliverable.
  const selected=selection.segments.map(choice=>{
    const segment=manifest.segments.find(s=>s.segmentIndex===choice.segmentIndex);
    insist(segment && !used.has(choice.segmentIndex),'Invalid or repeated segment selection');used.add(choice.segmentIndex);
    insist(Array.isArray(choice.candidates) && choice.candidates.length<=5 && new Set(choice.candidates).size===choice.candidates.length,'Choose up to five unique candidates per segment');
    insist(choice.candidates.length===5 || (typeof choice.reason==='string' && choice.reason.trim()),'Explain fewer than five usable images');
    return {segment,choice,candidates:choice.candidates.map(id=>{
      const c=segment.candidates.find(c=>c.id===id);insist(c && !c.rejected,`Unavailable candidate: ${id}`);return c;
    }).sort((a,b)=>a.time-b.time)};
  });
  for(const {segment,candidates,choice} of selected) {
    const prefix=`${manifest.slug}-${String(segment.segmentIndex+1).padStart(2,'0')}-${safeName(segment.name)}`;
    const exported=[];
    for(const c of candidates) {
      const name=`${prefix}-highlight-p${c.sourceIndex}-${timeLabel(c.sourceTime)}.jpg`,file=path.join(work,name);
      run('ffmpeg',['-v','error','-nostdin','-threads','1','-ss',String(c.sourceTime),'-i',c.source,'-frames:v','1','-threads','1','-q:v','2','-n',file]);
      insist(fs.statSync(file).size>0,'Empty exported frame');
      exported.push({...c,file});prepared.push([file,path.join(manifest.outputDirectory,name)]);
    }
    if(exported.length) {
      const name=`${prefix}-highlights-contact-sheet.jpg`,file=path.join(work,name);
      sheet(exported,file,`${segment.name} — selected promotional stills`);
      prepared.push([file,path.join(manifest.outputDirectory,name)]);
    }
    if(candidates.length<5) console.log(`${segment.name}: ${candidates.length}/5 — ${choice.reason}`);
  }
  await publishFiles(prepared,replace);
  const outputs=[];for(const [,file] of prepared) outputs.push({file,sha256:await checksum(file)});
  fs.writeFileSync(path.join(path.dirname(manifestFile),'published.json'),JSON.stringify(outputs,null,2)+'\n');
  console.log(`Saved ${outputs.length} highlight files in ${manifest.outputDirectory}`);
  return outputs;
}
