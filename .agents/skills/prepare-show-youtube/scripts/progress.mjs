import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// Run FFmpeg with machine-readable progress while retaining diagnostics on stderr.
const [durationText, stage, ...args] = process.argv.slice(2);
const duration = Number(durationText);
if (!(duration > 0) || !stage || !args.length) throw new Error('Expected duration, stage and FFmpeg arguments');
const child = spawn('ffmpeg', ['-progress', 'pipe:1', '-stats_period', '1', '-nostats', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
let processed = 0, speed = 0, complete = false;
function clock(seconds) {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function report() {
  const percent = Math.min(100, Math.max(0, processed / duration * 100));
  const eta = complete ? '0:00:00' : speed > 0 ? clock((duration - processed) / speed) : 'calculating';
  console.log(`${stage} ${percent.toFixed(1)}% | ETA ${eta}${complete ? ' | finished' : ''}`);
}
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  const index = line.indexOf('='), key = line.slice(0, index), value = line.slice(index + 1);
  if (key === 'out_time_us' && Number.isFinite(Number(value))) processed = Number(value) / 1e6;
  if (key === 'speed' && Number.isFinite(parseFloat(value))) speed = parseFloat(value);
});
report();
const timer = setInterval(report, 20_000);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); });
child.on('close', (code, signal) => {
  clearInterval(timer);
  if (code === 0) { complete = true; processed = duration; report(); }
  else console.error(`${stage} failed (${signal ?? code})`);
  process.exitCode = code === 0 ? 0 : code || 1;
});
