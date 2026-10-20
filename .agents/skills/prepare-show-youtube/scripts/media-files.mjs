import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const insist=(ok,message)=>{if(!ok) throw new Error(message);};
export const exists=file=>{try {fs.lstatSync(file);return true;} catch(e) {if(e.code==='ENOENT') return false;throw e;}};
export async function checksum(file) {
  const hash=createHash('sha256');
  for await(const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export function sourceFiles(spec,base) {
  return (spec.sources?.map(s=>s.source)??[spec.source]).map(file=>fs.realpathSync(path.resolve(base,file)));
}
export const recordingSlug=(slug,date)=>slug.endsWith(`-${date}`)||slug===date?slug:`${slug}-${date}`;
export function showDirectory(slug,sources,override,base) {
  insist(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(slug),'Unsafe show slug');
  if(override) return path.resolve(base,override);
  const parent=path.dirname(sources[0]);
  return path.basename(parent)===slug?parent:path.join(parent,slug);
}
export async function publishFiles(pairs,replace=false) {
  // Preflight the complete batch; exclusive creation also protects against races.
  for(const [source,target] of pairs) {
    insist(path.resolve(source)!==path.resolve(target),'Source and destination must differ');
    insist(!exists(target)||replace,`Output exists; explicit replacement authorization required: ${target}`);
    if(exists(target)) insist(fs.lstatSync(target).isFile(),'Destination must be a regular file');
  }
  const created=[];
  try {
    for(const [source,target] of pairs) {
      fs.mkdirSync(path.dirname(target),{recursive:true});
      if(replace && exists(target)) {
        const dir=fs.mkdtempSync(path.join(path.dirname(target),'.publish-'));
        try {
          const staged=path.join(dir,'file');fs.copyFileSync(source,staged,fs.constants.COPYFILE_EXCL);
          insist(await checksum(source)===await checksum(staged),'Publication checksum mismatch');
          fs.renameSync(staged,target);
        } finally {fs.rmSync(dir,{recursive:true,force:true});}
      } else {
        fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);created.push(target);
        insist(await checksum(source)===await checksum(target),'Publication checksum mismatch');
      }
    }
  } catch(error) {for(const target of created) fs.unlinkSync(target);throw error;}
}
export async function moveVerified(source,target) {
  if(path.resolve(source)===path.resolve(target)) return;
  insist(!exists(target),`Destination exists: ${target}`);
  const before=await checksum(source), stat=fs.statSync(source);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  let linked=false;
  try {fs.linkSync(source,target);linked=true;} catch(error) {
    if(!['EXDEV','EPERM','ENOTSUP','EOPNOTSUPP'].includes(error.code)) throw error;
    fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
  }
  try {
    insist(await checksum(target)===before,`Relocation checksum mismatch: ${target}`);
    if(!linked) fs.utimesSync(target,stat.atime,stat.mtime);
  } catch(error) {fs.unlinkSync(target);throw error;}
  fs.unlinkSync(source);
}
export async function organizeRecording(specFile,slug) {
  const base=path.dirname(specFile), spec=JSON.parse(fs.readFileSync(specFile,'utf8'));
  const references=spec.sources?.map(s=>s.source)??[spec.source];
  const files=sourceFiles(spec,base);
  insist(new Set(files).size===files.length,'Cannot organize repeated references to the same original recording');
  const directory=showDirectory(slug,files,spec.outputDirectory,base);
  const originals=files.map((file,i)=>path.join(directory,`${slug}-original${files.length>1?`-${i+1}`:''}${path.extname(file)}`));
  const moves=files.map((file,i)=>[file,originals[i]]).filter(([a,b])=>a!==b);
  // Include only recognized final deliverables and explicitly named review MP4s.
  const stem=`improv-circus-${slug}`;
  for(const parent of new Set(files.map(file=>path.dirname(file)))) {
    if(path.resolve(parent)===path.resolve(directory)) continue;
    for(const name of fs.readdirSync(parent)) {
      if(name===`${stem}.mp4` || name===`${stem}-youtube-description.txt` ||
        (name.startsWith(`${stem}-`) && /review[^/]*\.mp4$/.test(name))) {
        const file=path.join(parent,name);
        insist(fs.lstatSync(file).isFile(),`Deliverable must be a regular file: ${file}`);
        moves.push([file,path.join(directory,name)]);
      }
    }
  }
  const targets=new Set();
  for(const [,target] of moves) {
    insist(!exists(target) && !targets.has(target),`Destination exists: ${target}`);targets.add(target);
  }
  const primary=path.resolve(base,spec.source), primaryReal=fs.realpathSync(primary);
  const primaryIndex=files.indexOf(primaryReal);
  insist(primaryIndex>=0,'Primary source must be one of the original recordings');
  const rollback=[], repaired=[];
  try {
    for(const [source,target] of moves) {await moveVerified(source,target);rollback.push([target,source]);}
    // Repair temporary source links, including a primary alias not listed in sources.
    const links=new Map(references.map((ref,i)=>[path.resolve(base,ref),originals[i]]));
    links.set(primary,originals[primaryIndex]);
    for(const [link,target] of links) if(exists(link) && fs.lstatSync(link).isSymbolicLink()) {
      const old=fs.readlinkSync(link);fs.unlinkSync(link);fs.symlinkSync(target,link);repaired.push([link,old]);
    }
    spec.source=originals[primaryIndex];
    if(spec.sources) spec.sources.forEach((part,i)=>{part.source=originals[i];});
    spec.sourceHistory??=files.map((file,i)=>({originalPath:file,path:originals[i]}));
    spec.outputDirectory=directory;
    spec.tempDirectory??=os.tmpdir();
    const temp=`${specFile}.organizing-${process.pid}`;
    fs.writeFileSync(temp,JSON.stringify(spec,null,2)+'\n',{flag:'wx'});
    fs.renameSync(temp,specFile);
  } catch(error) {
    for(const [link,old] of repaired.reverse()) {fs.unlinkSync(link);fs.symlinkSync(old,link);}
    for(const [source,target] of rollback.reverse()) await moveVerified(source,target);
    throw error;
  }
  return {directory,originals,moved:moves.map(([,target])=>target)};
}
