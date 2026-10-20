import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { sourceFiles,showDirectory,recordingSlug,organizeRecording,publishFiles } from './media-files.mjs';
import { sampleHighlights,exportHighlights } from './highlights.mjs';

const home = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audioFilter = 'dynaudnorm=f=25:g=11:p=0.9,volume=3.0,alimiter=limit=0.95';
function insist(ok, message) { if (!ok) throw new Error(message); }
function run(command, args, capture = true) {
  const r = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: capture ? 'pipe' : 'inherit' });
  insist(!r.error && r.status === 0, `${command}: ${r.error?.message ?? r.stderr ?? `exit ${r.status}`}`);
  return r.stdout?.trim();
}
export function seconds(value) {
  insist(typeof value === 'string' && /^(?:\d+:)?\d{1,2}:\d{2}(?:\.\d+)?$/.test(value), `Invalid timecode: ${value}`);
  const parts = value.split(':').map(Number);
  insist(parts.at(-1) < 60 && (parts.length === 2 || parts[1] < 60), `Invalid timecode: ${value}`);
  return parts.reduce((n, part) => n * 60 + part, 0);
}
export function timeline(spec, sourceDuration) {
  const start = seconds(spec.start), end = seconds(spec.stopVideo ?? spec.end);
  insist(spec.stopVideo===undefined || spec.end===undefined || seconds(spec.end)===end, 'stopVideo and legacy end disagree');
  const wrapUp=spec.wrapUp===undefined ? undefined : seconds(spec.wrapUp)-start;
  insist(wrapUp===undefined || (wrapUp>=0 && wrapUp<=end-start), 'Wrap up must be inside the retained video');
  insist(start < end && end <= sourceDuration + 0.001, 'Trim interval must be inside source duration');
  insist(Array.isArray(spec.segments) && spec.segments.length > 0, 'Supply named segments');
  const segments = spec.segments.map((s, i) => {
    insist(typeof s.name === 'string' && s.name.trim() && !/[\r\n\x00]/.test(s.name), `Invalid segment name at ${i}`);
    return { name: s.name.trim(), time: seconds(s.time) - start };
  });
  segments.forEach((s, i) => {
    insist(s.time >= 0 && s.time < end - start && (!i || s.time > segments[i-1].time), 'Segment times must be unique, ordered and inside trim');
    s.end = segments[i+1]?.time ?? end - start;
    s.titled = spec.segments[i].titled ?? (i > 0 && i < segments.length - 1);
    if(s.titled && wrapUp!==undefined) {
      insist(s.time<wrapUp, 'Games must start before wrap up');
      s.end=Math.min(s.end,wrapUp);
    }
    insist(!s.titled || s.end - s.time >= 6, `Segment "${s.name}" must last at least six seconds`);
  });
  return { start, duration: end - start, segments, ...(wrapUp===undefined ? {} : {wrapUp}) };
}
export function overlayGeometry(rect) {
  insist(['x','y','width','height'].every(k=>Number.isFinite(rect[k])) && rect.x>=0 && rect.y>=0 && rect.width>0 && rect.height>0 && rect.x+rect.width<=1920 && rect.y+rect.height<=1080, 'Invalid source overlay rectangle');
  const crop={left:0,top:0,right:0,bottom:0,...rect.crop};
  insist(Object.values(crop).every(v=>Number.isFinite(v) && v>=0 && v<100) && crop.left+crop.right<100 && crop.top+crop.bottom<100, 'Invalid source overlay crop percentages');
  const x=Math.round(rect.x), y=Math.round(rect.y), width=Math.round(rect.width), height=Math.round(rect.height);
  const left=Math.round(rect.x+rect.width*crop.left/100), top=Math.round(rect.y+rect.height*crop.top/100);
  const right=Math.round(rect.x+rect.width*(1-crop.right/100)), bottom=Math.round(rect.y+rect.height*(1-crop.bottom/100));
  insist(right>left && bottom>top, 'Cropped source overlay is empty');
  return {x:left,y:top,width:right-left,height:bottom-top,resizeWidth:width,resizeHeight:height,cropX:left-x,cropY:top-y};
}
function prepareSourceOverlays(spec,media,t,base,work) {
  insist(spec.sourceOverlays===undefined || Array.isArray(spec.sourceOverlays), 'sourceOverlays must be an array');
  return (spec.sourceOverlays??[]).map((overlay,i)=>{
    const parts=Array.isArray(media)?media:[{start:t.start,end:t.start+t.duration}];
    insist(Number.isInteger(overlay.sourceIndex) && parts[overlay.sourceIndex], 'Invalid source overlay sourceIndex');
    const time=seconds(overlay.sourceStart), part=parts[overlay.sourceIndex];
    insist(time>=part.start && time<part.end, 'Source overlay must start in its retained source interval');
    const g=overlayGeometry(overlay), image=existing(path.resolve(base,overlay.image)), file=path.join(work,`source-overlay-${i}.png`);
    run('convert',[image,'-resize',`${g.resizeWidth}x${g.resizeHeight}!`,'-crop',`${g.width}x${g.height}+${g.cropX}+${g.cropY}`,'+repage',file]);
    return {...g,file,time,sourceIndex:overlay.sourceIndex};
  });
}
export function introTiming(spec, t, media) {
  if (!spec.introAudio) return null;
  insist(typeof spec.introAudio.source==='string' && spec.introAudio.source, 'Supply introAudio.source');
  insist(spec.introAudio.fadeComplete!==undefined, 'Supply introAudio.fadeComplete: original source timestamp where the 0.5-second fade completes');
  const first=Array.isArray(media)?media[0]:null;
  const start=first?first.start:t.start;
  const complete=seconds(spec.introAudio.fadeComplete)-start;
  const available=first?Math.min(first.end-first.start-first.fade,t.duration):t.duration;
  insist(complete>=0.5 && complete<=available, 'Intro fade must complete at least 0.5 seconds after show start and within the retained opening source before its join');
  return {complete};
}
export function introAudioFilters(source, music, complete, offset=0, output='a') {
  const start=complete-0.5;
  // Shift timestamps for the fade calculation, then reset both streams for mixing.
  return [
    `[${source}]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS+${offset}/TB,afade=t=in:st=${start}:d=0.5,asetpts=PTS-STARTPTS[introShow]`,
    `[${music}]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,alimiter=limit=0.95:level=false:latency=true,asetpts=PTS-STARTPTS+${offset}/TB,afade=t=out:st=${start}:d=0.5,asetpts=PTS-STARTPTS[introMusic]`,
    `[introShow][introMusic]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[${output}]`
  ];
}
export function resolveShow(spec, records) {
  insist(/^\d{4}-\d{2}-\d{2}$/.test(spec.date ?? '') && !Number.isNaN(Date.parse(spec.date)) && new Date(spec.date).toISOString().slice(0,10) === spec.date, 'Supply a valid local ISO show date');
  const matches = records.shows.filter(s => s.when.date === spec.date).map(s => {
    const type = records.types[s.type];
    insist(type, `Unknown show type: ${s.type}`);
    const result = { ...type };
    for (const [key, value] of Object.entries(s)) if (value != null) result[key] = value;
    result.slug = s.slug ?? `${type.slug.replaceAll('_','-')}-${s.when.date}`;
    result.theater = records.theaters[result.theater];
    insist(result.theater?.name, 'Show theater does not resolve');
    result.players = (s.players ?? []).map(k => { insist(records.players[k]?.name, `Unknown player ${k}`); return records.players[k].name; });
    result.guests = (s.guest_players ?? []).map(k => { insist(records.players[k]?.name, `Unknown guest ${k}`); return records.players[k].name; });
    return result;
  }).filter(s => !spec.showSlug || s.slug === spec.showSlug);
  insist(matches.length === 1, `Expected one show for ${spec.date}; found ${matches.length}. Resolve date or provide showSlug.`);
  insist(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(matches[0].slug), 'Unsafe show slug');
  return matches[0];
}
function stamp(t) {
  const n = Math.floor(t + 1e-7), h = Math.floor(n/3600), m = Math.floor(n/60)%60, s = String(n%60).padStart(2,'0');
  return h ? `${h}:${String(m).padStart(2,'0')}:${s}` : `${m}:${s}`;
}
export function chapters(t) {
  const rows = t.segments.map(s => ({ time:s.time, name:s.name }));
  if (rows[0].time > 0) rows.unshift({ time:0, name:'Show start' });
  const warnings = [];
  if (rows.length < 3) warnings.push('Fewer than three chapters');
  if (rows.some((s,i) => (rows[i+1]?.time ?? t.duration)-s.time < 10)) warnings.push('A chapter is shorter than ten seconds');
  if (rows.some((s,i) => i && Math.floor(s.time) === Math.floor(rows[i-1].time))) warnings.push('Chapter timestamps collapse to the same second');
  return { text:rows.map(s => `${stamp(s.time)} ${s.name}`).join('\n'), warnings };
}
export function wipeWidth(time, duration) { return Math.max(0, Math.min(1, time / 0.5, (duration - time) / 0.5)); }
function fullDate(date) {
  const d = new Date(`${date}T12:00:00Z`), day = d.getUTCDate();
  const suffix = day%100 >= 11 && day%100 <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'}[day%10] ?? 'th');
  const month = ['Jan','Feb','Mar','Apr','May','June','July','Aug','Sept','Oct','Nov','Dec'][d.getUTCMonth()];
  return `${month} ${day}${suffix}, ${d.getUTCFullYear()}`;
}
function description(show, spec, t) {
  return [`${show.name} — ${fullDate(spec.date)}`, `Recorded live at ${show.theater.name}.`, '',
    spec.summary?.trim() || show.headline || `A live performance of ${show.name}.`, '',
    show.players.length ? `Featuring: ${show.players.join(', ')}.` : '',
    show.guests.length ? `Special guests: ${show.guests.join(', ')}.` : '', '', 'Segments', chapters(t).text, '',
    'More Improv Circus: https://improv-circus.com', `Show details: https://improv-circus.com/shows/${show.slug}`, ''].filter(s => s !== null).join('\n');
}
export function videoMetadata(show, spec, t) {
  const location=show.theater.location ?? {};
  const address=[location.street, [location.city, [location.state,location.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  const venue=[show.theater.name,address].filter(Boolean).join(', ');
  return {
    title:`${show.name} — ${fullDate(spec.date)}`,
    description:description(show,spec,t),
    date:spec.date, artist:'Improv Circus',
    comment:`Recorded live on ${spec.date} at ${venue}.\nFeaturing: ${[...show.players,...show.guests].join(', ')}.`
  };
}
function probe(source) { return JSON.parse(run('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',source])); }
function existing(file) { insist(fs.existsSync(file), `Missing file: ${file}`); return file; }
function box(file) { return run('identify',['-format','%w %h',file]).split(' ').map(Number); }
function label(text, rect, out, font, fill, title=false, singleLine=false) {
  // Argument arrays avoid shell interpolation; escape ImageMagick text expansion.
  const caption = text.replaceAll("\\", "\\\\").replaceAll("%", "%%").replace(/^@/, "\\@");
  let fitted = false;
  for (let size=rect.fontSize; size >= (title ? rect.minFontSize : 18); size-=2) {
    run('convert',['-background','none','-font',font,'-pointsize',String(size),'-fill',fill,
      '-stroke',rect.strokeColor ?? 'black','-strokewidth',String(rect.stroke ?? (title ? 2 : 1)), '-gravity',title?'west':'east',
      ...(singleLine ? [] : ['-size',`${rect.width-20}x`]), `${singleLine?'label':'caption'}:${caption}`, '-trim','+repage',out]);
    const [w,h] = box(out);
    if (w<=rect.width-14 && h<=rect.height-14) { fitted=true; break; }
  }
  insist(fitted, `Text cannot fit legibly: ${text}`);
  const shadow = title ? rect.shadow : 2;
  const [width,height] = box(out);
  const x = title ? 7 : rect.width-width-shadow-7, y = Math.max(4,Math.floor((rect.height-height)/2));
  run('convert',[out,'-write','mpr:original','+delete','-size',`${rect.width}x${rect.height}`,'xc:none',
    'mpr:original','-fill','black','-colorize','100','-geometry',`+${x+shadow}+${y+shadow}`,'-composite',
    'mpr:original','-geometry',`+${x}+${y}`,'-composite',out]);
}
function artwork(show, spec, base, work, layout) {
  const font = existing(path.join(home,'assets/LuckiestGuy-Regular.ttf'));
  const sourcePath = p => path.resolve(base,p);
  const logos = [
    [spec.showLogo ? sourcePath(spec.showLogo) : /wry-vs-dry/.test(show.slug) ? path.join(spec.root,'marketing/Assets/00_brand_logos/wry-vs-dry-marquee-logo.png') : '',layout.showLogo],
    [spec.brandLogo ? sourcePath(spec.brandLogo) : path.join(spec.root,'marketing/Assets/00_brand_logos/improv-circus-logo.png'),layout.brandLogo]
  ];
  const layers = [];
  for (const [i,[logo,r]] of logos.entries()) {
    existing(logo); const output=path.join(work,`logo${i}.png`);
    run('convert',[logo,'-resize',`${r.width}x${r.height}`,'-background','none','-gravity','center','-extent',`${r.width}x${r.height}`,output]);
    layers.push([output,r]);
  }
  for (const [key,text,fill,fontName] of [['venue',show.theater.name,'white','DejaVu-Sans-Bold'],['date',fullDate(spec.date),'#bdbdbd','DejaVu-Sans']]) {
    const output=path.join(work,`${key}.png`); label(text,layout[key],output,fontName,fill); layers.push([output,layout[key]]);
  }
  const footer=path.join(work,'branding.png');
  const args=['-size','1920x1080','xc:none'];
  for (const [file,r] of layers) args.push(file,'-geometry',`+${r.x}+${r.y}`,'-composite');
  run('convert',[...args,footer]);
  const website=path.join(work,'website.png'); label('improv-circus.com',{...layout.title,...layout.websiteTitle},website,font,layout.title.fill,true,true); return { footer, font, website };
}
function render(source, target, t, art, titles, layout, offset=0, duration=t.duration) {
  const args=['-hide_banner','-loglevel','warning','-nostdin'], filters=[];
  let count=1;
  const patchSource=(input,output,sourceIndex,from)=>{
    let last=input;
    for(const [j,patch] of (art.sourceOverlays??[]).entries()) if(patch.sourceIndex===sourceIndex && patch.time<from+duration) {
      args.push('-loop','1','-framerate','30','-i',patch.file);
      const next=`patched${sourceIndex}_${j}`;
      filters.push(`[${last}][${count++}:v]overlay=${patch.x}:${patch.y}:format=yuv420:shortest=1:enable='gte(t,${Math.max(0,patch.time-from)})'[${next}]`);
      last=next;
    }
    filters.push(`[${last}]null[${output}]`);
  };
  if (Array.isArray(source)) {
    const parts=source.filter(p=>p.at < offset+duration && p.at+p.end-p.start > offset);
    count=parts.length;
    parts.forEach((p,i)=>{
      const from=Math.max(offset,p.at), to=Math.min(offset+duration,p.at+p.end-p.start);
      args.push('-ss',String(p.start+from-p.at),'-t',String(to-from),'-i',p.source);
      filters.push(`[${i}:v]setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,settb=AVTB[source${i}]`);
      filters.push(`[${i}:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[pa${i}]`);
    });
    parts.forEach((p,i)=>patchSource(`source${i}`,`pv${i}`,p.index,p.start+Math.max(offset,p.at)-p.at));
    let v='pv0', a='pa0';
    for(let i=1;i<parts.length;i++) {
      const fade=Math.min(parts[i].fade,parts[i].at+parts[i].fade-offset);
      const transition=Math.max(0,parts[i].at-offset);
      // Convert only the overlapping frames for xfade; keep the rest in YUV420.
      filters.push(`[${v}]split=2[prefixIn${i}][tailIn${i}]`);
      filters.push(`[prefixIn${i}]trim=end=${transition},setpts=PTS-STARTPTS[prefix${i}]`);
      filters.push(`[tailIn${i}]trim=start=${transition},setpts=PTS-STARTPTS[tail${i}]`);
      filters.push(`[pv${i}]split=2[headIn${i}][restIn${i}]`);
      filters.push(`[headIn${i}]trim=duration=${fade},setpts=PTS-STARTPTS[head${i}]`);
      filters.push(`[restIn${i}]trim=start=${fade},setpts=PTS-STARTPTS[rest${i}]`);
      filters.push(`[tail${i}][head${i}]xfade=transition=fade:duration=${fade}:offset=0,format=yuv420p[fade${i}]`);
      const pieces=transition>0 ? `[prefix${i}][fade${i}][rest${i}]` : `[fade${i}][rest${i}]`;
      if(transition===0) filters.push(`[prefix${i}]nullsink`);
      filters.push(`${pieces}concat=n=${transition>0?3:2}:v=1:a=0[jv${i}]`);
      filters.push(`[${a}][pa${i}]acrossfade=d=${fade}:c1=tri:c2=tri[ja${i}]`);
      v=`jv${i}`; a=`ja${i}`;
    }
    filters.push(`[${v}]null[v0]`, `[${a}]${audioFilter}[a]`);
  } else {
    args.push('-ss',String(t.start+offset),'-i',source);
    filters.push(`[0:v:0]trim=duration=${duration},setpts=PTS-STARTPTS,scale=w='trunc(iw*sar/2)*2':h=ih,setsar=1,scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black[source0]`);
    patchSource('source0','v0',0,t.start+offset);
    filters.push(`[0:a:0]atrim=duration=${duration},asetpts=PTS-STARTPTS,${audioFilter}[a]`);
  }
  args.push('-loop','1','-framerate','30','-i',art.footer,'-loop','1','-framerate','30','-i',art.website);
  for (const title of titles) args.push('-loop','1','-framerate','30','-i',title.file);
  filters.push(`[v0][${count}:v]overlay=0:0:format=yuv420:shortest=1[branded]`);
  const games=t.segments.filter(s=>s.titled), opening=games[0]?.time??t.duration, closing=t.wrapUp ?? (games.at(-1) ? (t.segments.at(-1).titled ? games.at(-1).end-4.5 : t.segments.at(-1).time) : t.duration);
  filters.push(`[branded][${count+1}:v]overlay=${layout.title.x}:${layout.title.y}:format=yuv420:shortest=1:enable='lt(t,${opening-offset})+gte(t,${closing-offset})'[v1]`);
  let last='v1';
  titles.forEach((title,i) => {
    const s=title.segment, visible=s.end-s.time-4.5, start=s.time-offset;
    const elapsed=Math.max(0,-start), remaining=Math.min(visible-elapsed,duration-Math.max(0,start));
    // Compute the moving alpha edge only during each half-second wipe.
    // The much longer fully visible interval reuses the static image.
    const spans=[[0,0.5,true],[0.5,visible-0.5,false],[visible-0.5,visible,true]]
      .map(([a,b,wipe])=>({from:Math.max(a,elapsed),to:Math.min(b,elapsed+remaining),wipe}))
      .filter(p=>p.to>p.from+1e-7);
    if(!spans.length) return;
    filters.push(`[${i+count+2}:v]format=rgba,split=${spans.length}${spans.map((_,j)=>`[tile${i}_${j}]`).join('')}`);
    spans.forEach((p,j)=>{
      const clip=`clip(min((T+${p.from})/0.5,(${visible}-T-${p.from})/0.5),0,1)`;
      const mask=p.wipe ? `,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X,W*${clip}),alpha(X,Y),0)'` : '';
      filters.push(`[tile${i}_${j}]trim=duration=${p.to-p.from},setpts=PTS-STARTPTS${mask}[span${i}_${j}]`);
    });
    filters.push(`${spans.map((_,j)=>`[span${i}_${j}]`).join('')}concat=n=${spans.length}:v=1:a=0,setpts=PTS+(${Math.max(0,start)})/TB[title${i}]`);
    filters.push(`[${last}][title${i}]overlay=${layout.title.x}:${layout.title.y}:eof_action=pass:repeatlast=0:format=yuv420:enable='between(t,${start},${start+visible})'[v${i+2}]`);
    last=`v${i+2}`;
  });
  if(art.intro && offset<art.intro.complete) {
    const musicIndex=count+2+titles.length;
    args.push('-ss',String(offset),'-t',String(Math.min(duration,art.intro.complete-offset)),'-i',art.intro.source);
    // Keep existing normalization upstream, before the opening override.
    const audioIndex=filters.findIndex(f=>f.endsWith('[a]'));
    filters[audioIndex]=filters[audioIndex].replace('[a]','[showAudio]');
    filters.push(...introAudioFilters('showAudio',`${musicIndex}:a:0`,art.intro.complete,offset));
  }
  args.push('-filter_complex_threads','1','-filter_complex',filters.join(';'),'-map',`[${last}]`,'-map','[a]',
    '-t',String(duration),'-c:v','libx264','-preset','medium','-b:v','8M','-maxrate','8M','-bufsize','16M','-pix_fmt','yuv420p','-fps_mode','passthrough','-enc_time_base:v','1:90000',
    '-c:a','aac','-b:a','192k',...Object.entries(art.metadata??{}).flatMap(([key,value])=>['-metadata',`${key}=${value}`]),'-movflags','+faststart','-n',target);
  run(process.execPath,[path.join(home,'scripts/progress.mjs'),String(duration),'Rendering',...args],false);
}
export async function main(argv=process.argv.slice(2)) {
  const opts={};
  for(let i=0;i<argv.length;i++) {
    const k=argv[i]; insist(['--spec','--root','--mode','--replace','--candidates','--selection','--resume'].includes(k),`Unknown option ${k}`);
    opts[k]=['--replace','--resume'].includes(k)?true:argv[++i];
  }
  insist(opts['--spec'],'Usage: prepare.mjs --spec recording.json --mode validate|organize|preview|render|highlights [--root project] [--replace] [--candidates directory] [--selection selection.json]');
  const root=path.resolve(opts['--root']??process.cwd()), specFile=path.resolve(opts['--spec']), base=path.dirname(specFile);
  const spec=JSON.parse(fs.readFileSync(specFile,'utf8')); spec.root=root;
  insist(spec.summary === undefined || (typeof spec.summary === 'string' && spec.summary.trim()), 'Summary must be nonempty text');
  const mode=opts['--mode']??'validate'; insist(['validate','organize','preview','render','highlights'].includes(mode),'Invalid mode');
  insist(mode==='highlights'||(!opts['--candidates']&&!opts['--selection']&&!opts['--resume']),'Candidate and selection options require highlights mode');
  insist(!opts['--resume'] || !opts['--selection'],'Resume applies to candidate sampling, not export');
  const require=createRequire(path.join(root,'package.json')), yaml=require('js-yaml');
  const read=name=>yaml.load(fs.readFileSync(path.join(root,'src/_models/data',name),'utf8'),{schema:yaml.CORE_SCHEMA.withTags(yaml.mergeTag)});
  const show=resolveShow(spec,{shows:read('show_data.yaml'),types:read('show_types.yaml'),theaters:read('theater_data.yaml'),players:read('player_data.yaml')});
  const fileSlug=recordingSlug(show.slug,spec.date);
  if(mode==='organize') {console.log(JSON.stringify(await organizeRecording(specFile,fileSlug),null,2));return;}
  insist(typeof spec.source==='string' && spec.source,'Supply source video path');
  const source=existing(path.resolve(base,spec.source)), metadata=probe(source);
  insist(metadata.streams.some(s=>s.codec_type==='video') && metadata.streams.some(s=>s.codec_type==='audio'),'Source needs video and audio streams');
  const sourceDuration=Number(metadata.format.duration); insist(Number.isFinite(sourceDuration),'Cannot determine source duration');
  let media=source, total=sourceDuration;
  if(spec.sources) {
    insist(spec.sources.length>=2,'Supply at least two sources');
    const fade=spec.crossfade??0.2;
    insist(Number.isFinite(fade) && fade>0,'Crossfade must be positive');
    total=0;
    media=spec.sources.map((part,i)=>{
      const file=existing(path.resolve(base,part.source)), info=probe(file), start=seconds(part.start), end=seconds(part.end);
      insist(info.streams.some(s=>s.codec_type==='video') && info.streams.some(s=>s.codec_type==='audio'),'Every source needs video and audio');
      insist(end<=Number(info.format.duration)+0.001 && end-start>fade,'Invalid source trim');
      const at=total-(i?fade:0); total=at+end-start;
      return {source:file,start,end,at,fade,index:i};
    });
    insist(seconds(spec.start)===0 && Math.abs(seconds(spec.stopVideo??spec.end)-total)<0.001,'Joined spec must cover the complete joined timeline');
  }
  const intro= introTiming(spec,timeline(spec,total),media);
  if(intro) {
    intro.source=existing(path.resolve(base,spec.introAudio.source));
    const music=probe(intro.source);
    insist(music.streams.some(s=>s.codec_type==='audio') && Number(music.format.duration)>=intro.complete,'Intro track needs audio long enough to cover the fade');
  }
  const directory=showDirectory(fileSlug,sourceFiles(spec,base),spec.outputDirectory,base);
  const t=timeline(spec,total), stem=`improv-circus-${fileSlug}`, output=path.join(directory,`${stem}.mp4`), copy=output.replace(/\.mp4$/,'-youtube-description.txt');
  insist(path.resolve(source)!==output,'Source and destination must differ');
  const sourceStat=fs.statSync(source);
  for(const destination of [output,copy]) if(fs.existsSync(destination)) { const stat=fs.statSync(destination); insist(stat.dev!==sourceStat.dev || stat.ino!==sourceStat.ino, 'A destination aliases the source recording'); }
  for(const part of Array.isArray(media)?media:[]) {
    const st=fs.statSync(part.source);
    for(const dest of [output,copy]) if(fs.existsSync(dest)) { const d=fs.statSync(dest); insist(d.dev!==st.dev || d.ino!==st.ino,'Destination aliases a source'); }
  }
  const tempRoot=spec.tempDirectory?path.resolve(base,spec.tempDirectory):os.tmpdir();
  insist(tempRoot!==directory && !tempRoot.startsWith(directory+path.sep),'Temporary files must stay outside the final show directory');
  fs.mkdirSync(tempRoot,{recursive:true});
  if(mode==='highlights') {
    insist(opts['--candidates'],'Supply --candidates with a local temporary directory');
    const candidates=path.resolve(opts['--candidates']);
    insist(candidates!==directory && !candidates.startsWith(directory+path.sep),'Keep candidate images outside the final show directory');
    if(opts['--selection']) {
      const work=fs.mkdtempSync(path.join(tempRoot,'show-highlights-export-'));
      try {
        const manifestFile=path.join(candidates,'candidates.json');
        const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
        insist(manifest.slug===fileSlug && path.resolve(manifest.outputDirectory)===directory,'Candidate manifest belongs to a different show or output directory');
        await exportHighlights(manifestFile,path.resolve(opts['--selection']),work,!!opts['--replace']);
      } finally {fs.rmSync(work,{recursive:true,force:true});}
    } else sampleHighlights({slug:fileSlug,timeline:t,media,outputDirectory:directory,includeEdges:spec.highlights?.includeEdges===true},candidates,!!opts['--resume']);
    return;
  }
  const layout=JSON.parse(fs.readFileSync(spec.layout?path.resolve(base,spec.layout):path.join(home,'assets/layout.json'),'utf8'));
  for (const key of ['showLogo','brandLogo','title','venue','date']) {
    const r=layout[key]; insist(r && ['x','y','width','height'].every(k=>Number.isFinite(r[k])) && r.x>=0 && r.y>=0 && r.width>0 && r.height>0 && r.x+r.width<=1920 && r.y+r.height<=1080,`Invalid layout ${key}`);
  }
  for (const key of ['title','venue','date']) insist(Number.isFinite(layout[key].fontSize) && layout[key].fontSize>=18 && layout[key].fontSize<=300, `Invalid font size ${key}`);
  insist(Number.isFinite(layout.title.minFontSize) && layout.title.minFontSize>=18 && layout.title.minFontSize<=layout.title.fontSize && Number.isFinite(layout.title.stroke) && layout.title.stroke>=0 && Number.isFinite(layout.title.shadow) && layout.title.shadow>=0 && /^#[0-9a-f]{6}$/i.test(layout.title.fill), 'Invalid title styling');
  const capabilities=run('ffmpeg',['-hide_banner','-filters']);
  for(const f of ['geq','overlay','scale','pad','dynaudnorm','alimiter']) insist(new RegExp(`\\b${f}\\b`).test(capabilities),`FFmpeg missing ${f}`);
  insist(run('ffmpeg',['-hide_banner','-encoders']).includes('libx264'),'FFmpeg needs libx264');
  run('convert',['-version']); run('identify',['-version']);
  insist(spec.previewDuration===undefined || (Number.isFinite(spec.previewDuration) && spec.previewDuration>0 && spec.previewDuration<=t.duration),'Preview duration must be positive seconds within the trimmed show');
  const warnings=chapters(t).warnings;
  const work=fs.mkdtempSync(path.join(tempRoot,'show-youtube-'));
  try {
    const art=artwork(show,spec,base,work,layout), titles=[];
    art.metadata=videoMetadata(show,spec,t);
    art.intro=intro;
    art.sourceOverlays=prepareSourceOverlays(spec,media,t,base,work);
    for(const [i,s] of t.segments.entries()) if(s.titled) {
      const file=path.join(work,`title${i}.png`); label(s.name,layout.title,file,art.font,layout.title.fill,true); titles.push({file,segment:s});
    }
    console.log(JSON.stringify({show:show.name,slug:show.slug,source,output,description:copy,duration:t.duration,warnings},null,2));
    if(mode==='validate') return;
    if(mode==='preview') {
      const dir=path.join(tempRoot,`${stem}-preview`);
      insist(opts['--replace'] || !fs.existsSync(dir),`Preview exists; explicit replacement authorization required: ${dir}`);
      fs.mkdirSync(dir,{recursive:true});
      const requested=spec.previewDuration!==undefined;
      const offset=requested?0:(titles[0]?.segment.time??0), length=requested?spec.previewDuration:Math.min(2,t.duration-offset);
      const entrance=path.join(work,'entrance.mp4'); render(media,entrance,t,art,requested?titles:titles.slice(0,1),layout,offset,length);
      const temp=path.join(work,'preview.mp4');
      if(titles[0] && !requested) {
        const exit=path.join(work,'exit.mp4'); render(media,exit,t,art,titles.slice(0,1),layout,titles[0].segment.end-6,Math.min(2,t.duration-(titles[0].segment.end-6)));
        const list=path.join(work,'concat.txt'); fs.writeFileSync(list,"file 'entrance.mp4'\nfile 'exit.mp4'\n");
        run('ffmpeg',['-v','error','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',temp]);
      } else fs.copyFileSync(entrance,temp);
      const still=path.join(work,'preview.png'); run('ffmpeg',['-v','error','-ss',String(Math.min(1,length/2)),'-i',temp,'-frames:v','1',still]);
      fs.copyFileSync(temp,path.join(dir,'preview.mp4')); fs.copyFileSync(still,path.join(dir,'preview.png'));
      fs.writeFileSync(path.join(dir,'youtube-description.txt'),description(show,spec,t)); console.log(`Preview: ${dir}`); return;
    }
    for(const file of [output,copy]) insist(opts['--replace']||!fs.existsSync(file),`Output exists; explicit replacement authorization required: ${file}`);
    const stagedDir=fs.mkdtempSync(path.join(work,'render-'));
    try {
      const staged=path.join(stagedDir,'video.mp4'); render(media,staged,t,art,titles,layout);
      const result=probe(staged), video=result.streams.find(s=>s.codec_type==='video'),audio=result.streams.find(s=>s.codec_type==='audio');
      insist(video?.width===1920 && video.height===1080 && video.codec_name==='h264' && video.pix_fmt==='yuv420p' && audio?.codec_name==='aac','Output stream validation failed');
      insist(Math.abs(Number(result.format.duration)-t.duration)<0.25,'Output duration validation failed');
      run(process.execPath,[path.join(home,'scripts/progress.mjs'),String(t.duration),'Verifying','-v','error','-xerror','-i',staged,'-f','null','-'],false);
      const stagedCopy=path.join(stagedDir,'description.txt'); fs.writeFileSync(stagedCopy,description(show,spec,t));
      await publishFiles([[staged,output],[stagedCopy,copy]],!!opts['--replace']);
      console.log(`Saved: ${output}\nSaved: ${copy}`);
    } finally { fs.rmSync(stagedDir,{recursive:true,force:true}); }
  } finally { fs.rmSync(work,{recursive:true,force:true}); }
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
