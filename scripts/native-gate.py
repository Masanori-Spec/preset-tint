#!/usr/bin/env python3
"""Hosted official CLI only. Never executes user-provided SCAD."""
from pathlib import Path
import hashlib,importlib.util,json,os,subprocess,traceback
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'artifacts/native';ART.mkdir(parents=True,exist_ok=True)
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
oracle=module('native_oracle',ROOT/'scripts/native-oracle.py');presets=module('preset_oracle',ROOT/'scripts/verify-presets.py')
REPORT={'status':'RUNNING','scope':'Official OpenSCAD CLI preset import into original synthetic fixture only; no GUI-authoring claim','cases':[]}
def run(binary,name,preset_file,set_name):
 out=ART/f'{name}.csg';out.unlink(missing_ok=True)
 args=[str(binary),'-o',str(out),'-p',str(preset_file),'-P',set_name,str(ROOT/'test/fixtures/fixture.scad')]
 result=subprocess.run(args,cwd=ROOT,env=dict(os.environ,QT_QPA_PLATFORM='xcb'),capture_output=True,text=True,timeout=90)
 log=result.stdout+result.stderr;(ART/f'{name}.log').write_text(log);assert result.returncode==0,f'Official CLI {name} failed: {result.returncode}: {log}'
 assert out.is_file()and out.stat().st_size>0,'Native CSG missing';text=out.read_text();entry=oracle.check(text,log,name);entry.update(exitCode=result.returncode,csgSHA256=hashlib.sha256(out.read_bytes()).hexdigest());REPORT['cases'].append(entry);return text

def main():
 assert os.environ.get('GITHUB_ACTIONS')=='true'and os.environ.get('DISPLAY'),'Use the hosted virtual display only'
 binary=Path((Path(os.environ['RUNNER_TEMP'])/'preset-tint-openscad/launcher.txt').read_text().strip())
 version=subprocess.run([str(binary),'--version'],capture_output=True,text=True,timeout=30,env=dict(os.environ,QT_QPA_PLATFORM='xcb'))
 actual_version=(version.stdout+version.stderr).strip();assert version.returncode==0 and 'OpenSCAD' in actual_version;REPORT['actualVersionOutput']=actual_version;(ART/'actual-version.txt').write_text(actual_version+'\n')
 checked=presets.verify();(ART/'independent-presets-report.json').write_text(json.dumps(checked,indent=2)+'\n')
 before=run(binary,'original',ROOT/'test/fixtures/original.json','Palette');after=run(binary,'edited',ART/'edited.json','Palette')
 assert oracle.geometry_signature(before)==oracle.geometry_signature(after),'CSG outside color values changed'
 other_before=run(binary,'other-original',ROOT/'test/fixtures/original.json','Other');other_after=run(binary,'other-edited',ART/'edited.json','Other');assert other_before==other_after,'Unselected preset native CSG changed'
 for name in ['wrong-arity','json-array']:
  bad=run(binary,name,ART/f'{name}.json','Palette');wrong=oracle.reject_positive(bad);assert oracle.geometry_signature(bad)==oracle.geometry_signature(after)
  REPORT['cases'][-1].update(rejectedByPositiveColorOracle=True,exactRGBDefaultFallbackObserved=True)
 REPORT.update(status='PASS',selectedKeys=['paint_hex','paint_rgb','paint_rgba'],nonColorCSGUnchanged=True,unselectedPresetCSGUnchanged=True,independentPresetBytes=checked)
if __name__=='__main__':
 try:main()
 except Exception as e:REPORT.update(status='FAIL',reason=str(e),traceback=traceback.format_exc());raise
 finally:(ART/'native-report.json').write_text(json.dumps(REPORT,indent=2,default=float)+'\n');print(json.dumps(REPORT,indent=2,default=float))
