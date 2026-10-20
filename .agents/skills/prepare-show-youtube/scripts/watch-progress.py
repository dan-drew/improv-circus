#!/usr/bin/env python3
"""Print progress from an existing show render without altering the job."""
import argparse
import datetime
import json
import re
import time
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('job_directory', type=Path)
parser.add_argument('--once', action='store_true')
args = parser.parse_args()

def duration(seconds):
    seconds = max(0, round(seconds))
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)
    return f'{hours:d}:{minutes:02d}:{seconds:02d}'

while True:
    try:
        status = json.loads((args.job_directory / 'full-render-status.json').read_text())
        log_path = args.job_directory / 'full-render.log'
        with log_path.open('rb') as log:
            log.seek(max(0, log_path.stat().st_size - 65536))
            tail = log.read().decode('utf-8', errors='replace')
        stage = status.get('stage', 'unknown')
        stamp = datetime.datetime.now().strftime('%H:%M:%S')
        if stage == 'rendering':
            samples = re.findall(r'time=(\d+):(\d+):([\d.]+).*?speed=\s*([\d.]+)x', tail)
            if samples:
                hours, minutes, seconds, speed = map(float, samples[-1])
                processed = hours * 3600 + minutes * 60 + seconds
                total = float(status['duration_seconds'])
                remaining = (total - processed) / speed if speed > 0 else None
                eta = duration(remaining) if remaining is not None else 'calculating'
                stale = ' | measurement stale' if time.time() - log_path.stat().st_mtime > 90 else ''
                print(f'{stamp} Rendering {min(100, processed / total * 100):5.1f}% | ETA {eta}{stale}', flush=True)
            else:
                print(f'{stamp} Rendering | waiting for first measurement', flush=True)
        else:
            print(f'{stamp} {stage.replace("_", " ").capitalize()}', flush=True)
            if stage in ('complete', 'failed'):
                if stage == 'failed':
                    print(json.dumps(status), flush=True)
                break
    except (OSError, ValueError, KeyError) as error:
        print(f'Progress unavailable: {error}', flush=True)
    if args.once:
        break
    time.sleep(20)
