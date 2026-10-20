import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {seconds,introAudioFilters} from './prepare.mjs';
const options={};
for(let i=2;i<process.argv.length;i+=2) {
  if(!['--source','--music','--fade-complete','--output'].includes(process.argv[i]) || !process.argv[i+1]) throw Error('Expected --source, --music, --fade-complete and --output');
  options[process.argv[i]]=process.argv[i+1];
}
for(const key of ['--source','--music','--fade-complete','--output']) if(!options[key]) throw Error(`Missing ${key}`);
function run(command,args,live=false) {
  const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:32*1024*1024,stdio:live?'inherit':'pipe'});
  if(r.error || r.status!==0) throw Error(`${command}: ${r.error?.message??r.stderr??r.status}`);
  return r.stdout?.trim();
}
const probe=file=>JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-show_chapters','-of','json',file]));
const source=path.resolve(options['--source']),music=path.resolve(options['--music']),output=path.resolve(options['--output']);
if(fs.existsSync(output)) throw Error(`Output exists: ${output}`);
const before=probe(source),track=probe(music),duration=Number(before.format.duration),complete=seconds(options['--fade-complete']);
if(!(complete>=0.5 && complete<=duration && complete<=Number(track.format.duration)) || !track.streams.some(s=>s.codec_type==='audio')) throw Error('Invalid fade timing or music duration');
if(!before.streams.some(s=>s.codec_type==='video') || !before.streams.some(s=>s.codec_type==='audio')) throw Error('Source needs video and audio');
fs.mkdirSync(path.dirname(output),{recursive:true});
const work=fs.mkdtempSync(path.join(path.dirname(output),'intro-audio-'));
const staged=path.join(work,'review.mp4');
const progress=path.join(path.dirname(fileURLToPath(import.meta.url)),'progress.mjs');
try {
  run(process.execPath,[progress,String(duration),'Updating audio','-v','warning','-nostdin','-i',source,'-t',String(complete),'-i',music,'-filter_complex',introAudioFilters('0:a:0','1:a:0',complete).join(';'),'-map','0:v:0','-map','[a]','-map_metadata','0','-map_chapters','0','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart','-n',staged],true);
  const after=probe(staged);
  if(Math.abs(Number(after.format.duration)-duration)>0.05 || after.streams.find(s=>s.codec_type==='audio')?.codec_name!=='aac') throw Error('Duration/audio validation failed');
  for(const [key,value] of Object.entries(before.format.tags??{})) if(['title','description','date','artist','comment'].includes(key) && after.format.tags?.[key]!==value) throw Error(`Metadata changed: ${key}`);
  if(JSON.stringify(before.chapters)!==JSON.stringify(after.chapters)) throw Error('Chapters changed');
  const videoHash=file=>run('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-']);
  if(videoHash(source)!==videoHash(staged)) throw Error('Video packet hashes differ');
  run(process.execPath,[progress,String(duration),'Verifying audio','-v','error','-xerror','-i',staged,'-map','0:a:0','-f','null','-'],true);
  fs.copyFileSync(staged,output,fs.constants.COPYFILE_EXCL);
  // The stage and review copy must match byte-for-byte before removing intermediates.
  const hash=file=>run('sha256sum',[file]).split(' ')[0];
  if(hash(staged)!==hash(output)) throw Error('Review copy checksum mismatch');
  console.log(`Saved and verified: ${output}`);
} finally {fs.rmSync(work,{recursive:true,force:true});}
