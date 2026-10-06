#!/usr/bin/env python3
"""Verify publisher metadata and exact official bytes before any execution."""
from pathlib import Path
import hashlib,json,os,subprocess,urllib.request
ROOT=Path(__file__).resolve().parents[1]
def main():
 assert os.environ.get('GITHUB_ACTIONS')=='true','Official consumer runs only in hosted CI'
 pin=json.loads((ROOT/'scripts/openscad-release.json').read_text());dest=Path(os.environ['RUNNER_TEMP'])/'preset-tint-openscad';dest.mkdir(exist_ok=True)
 with urllib.request.urlopen(pin['checksumUrl'],timeout=40)as r:publisher=r.read(4096).decode('ascii')
 fields=publisher.split();assert fields==[pin['sha256'],pin['fileName']],'Official publisher checksum metadata mismatch'
 path=dest/pin['fileName'];h=hashlib.sha256();size=0
 with urllib.request.urlopen(pin['url'],timeout=90)as response,path.open('wb')as target:
  while chunk:=response.read(1024*1024):
   size+=len(chunk);assert size<=pin['bytes'],'Oversized official archive';h.update(chunk);target.write(chunk)
 assert size==pin['bytes']and h.hexdigest()==pin['sha256'],'Official AppImage size/hash mismatch'
 path.chmod(0o755);subprocess.run([str(path),'--appimage-extract'],cwd=dest,check=True,stdout=subprocess.DEVNULL,timeout=90)
 binary=dest/'squashfs-root/AppRun';assert binary.is_file();(dest/'launcher.txt').write_text(str(binary)+'\n')
 art=ROOT/'artifacts/native';art.mkdir(parents=True,exist_ok=True);(art/'official-consumer-pin.json').write_text(json.dumps({**pin,'publisherChecksum':publisher,'verifiedBytes':size,'verifiedSHA256':h.hexdigest(),'beforeExecution':True},indent=2)+'\n')
 print('Exact official OpenSCAD publisher checksum, size and hash verified before extraction')
if __name__=='__main__':main()
