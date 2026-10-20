#!/usr/bin/env node
// Wait for an existing job's successful publication before moving its open inputs.
import fs from 'node:fs';
import path from 'node:path';
import { main } from './prepare.mjs';

const args=process.argv.slice(2),opts={};
for(let i=0;i<args.length;i+=2) {
  if(!['--job','--spec','--root'].includes(args[i]) || !args[i+1]) throw new Error('Usage: organize-after-job.mjs --job directory --spec recording.json --root project');
  opts[args[i]]=path.resolve(args[i+1]);
}
if(!opts['--job']||!opts['--spec']||!opts['--root']) throw new Error('Supply --job, --spec and --root');
const statusFile=path.join(opts['--job'],'organization-status.json');
function status(stage,extra={}) {
  const result={stage,pid:process.pid,updated_utc:new Date().toISOString(),...extra};
  fs.writeFileSync(statusFile,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
try {
  status('waiting_for_render');
  let missing=0;
  for(;;) {
    const state=JSON.parse(fs.readFileSync(path.join(opts['--job'],'full-render-status.json'),'utf8'));
    if(state.stage==='failed') throw new Error('Render failed; originals and outputs were not moved');
    if(state.stage==='complete') break;
    try {process.kill(state.pid,0);missing=0;} catch(error) {if(error.code!=='EPERM') missing++;}
    if(missing>=3) throw new Error('Render process disappeared before successful completion; nothing moved');
    await new Promise(resolve=>setTimeout(resolve,20000));
  }
  status('organizing');
  await main(['--root',opts['--root'],'--spec',opts['--spec'],'--mode','organize']);
  const spec=JSON.parse(fs.readFileSync(opts['--spec'],'utf8'));
  status('complete',{outputDirectory:spec.outputDirectory});
} catch(error) {status('failed',{error:error.message});process.exitCode=1;}
