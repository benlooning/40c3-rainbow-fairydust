"""Add the full anthem to both video formats without re-encoding the picture.

Requires FFmpeg/FFprobe. Run after render.py. Optional: --audio /path/to/master.
"""
from pathlib import Path
import argparse
import json
import subprocess

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio', type=Path, default=ROOT / 'assets' / 'soundtrack.flac')
    args = parser.parse_args()
    metadata = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'json', str(args.audio)]))
    duration = metadata['format']['duration']
    for aspect in ['16x9', '9x16']:
        source = ROOT / 'build' / f'40c3-fairydust-{aspect}.mp4'
        target = ROOT / 'build' / f'40c3-fairydust-{aspect}-sound.mp4'
        subprocess.run([
            'ffmpeg', '-y', '-loglevel', 'error', '-stream_loop', '-1',
            '-i', str(source), '-i', str(args.audio), '-map', '0:v:0', '-map', '1:a:0',
            '-t', duration, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
            '-ar', '48000', '-shortest', '-movflags', '+faststart',
            '-metadata', 'title=Model Citizens – 40C3 Rainbow Anthem',
            '-metadata', 'comment=Fairydust animation: benlooning',
            str(target)], check=True)
        print(f'Created {target.name}: {float(duration):g}s with soundtrack', flush=True)


if __name__ == '__main__':
    main()
