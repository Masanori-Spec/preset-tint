#!/usr/bin/env python3
"""Independent literal fixture/byte oracle; never imports the JavaScript core."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def verify(art=None):
 art=art or ROOT/'artifacts/native';before=(ROOT/'test/fixtures/original.json').read_bytes();after=(art/'edited.json').read_bytes()
 # Handwritten token replacements, independent of editor spans and receipt.
 expected=before.replace(b'"#000000"',b'"#ff0000"',1).replace(b'"[0.25, 0.5, 0.75]"',b'"[0, 1, 0]"',1).replace(b'"[0.5, 0.25, 0.75, 0.25]"',b'"[0, 0, 1, 0.5]"',1)
 assert after==expected,'A non-selected byte changed or a selected value is wrong'
 a,b=json.loads(before),json.loads(after);oracle=json.loads((ROOT/'test/expected-native.json').read_text())
 assert b['fileFormatVersion']=='1';assert b['metadata']==a['metadata'];assert b['parameterSets']['Other']==a['parameterSets']['Other']
 for key,value in a['parameterSets']['Palette'].items():
  actual=b['parameterSets']['Palette'][key];assert isinstance(actual,str)
  assert actual==oracle['encodedValues'].get(key,value)
 assert set(a['parameterSets'])==set(b['parameterSets']);assert set(a['parameterSets']['Palette'])==set(b['parameterSets']['Palette'])
 receipt=json.loads((art/'receipt.json').read_text());assert receipt['preset']=='Palette';assert set(receipt['changedKeys'])==set(oracle['selectedKeys']);assert len(receipt['edits'])==3
 for edit in receipt['edits']:
  assert edit['before']==a['parameterSets']['Palette'][edit['key']];assert edit['after']==oracle['encodedValues'][edit['key']]
  assert edit['arity']=={'paint_hex':3,'paint_rgb':3,'paint_rgba':4}[edit['key']]
 for name,value in [('wrong-arity','[0, 1, 0, 1]'),('json-array',[0,1,0])]:
  bad=json.loads((art/f'{name}.json').read_text());assert bad['parameterSets']['Palette']['paint_rgb']==value
  bad['parameterSets']['Palette']['paint_rgb']=b['parameterSets']['Palette']['paint_rgb'];assert bad==b,'Negative changed more than the intended RGB value'
 return {'status':'PASS','allNonselectedBytesUnchanged':True,'selectedValues':oracle['encodedValues'],'otherPresetAndGeometryValuesUnchanged':True,'encodedStringTypesPreserved':True,'negativeInputsOnlyChangeRGB':True,'inputSHA256':hashlib.sha256(before).hexdigest(),'outputSHA256':hashlib.sha256(after).hexdigest()}
if __name__=='__main__':
 result=verify();path=ROOT/'artifacts/native/independent-presets-report.json';path.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
