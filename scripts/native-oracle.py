#!/usr/bin/env python3
"""Independent exact CSG colors, matrices, cube sizes and native ECHO values."""
from pathlib import Path
from decimal import Decimal
import json,re
ROOT=Path(__file__).resolve().parents[1]
ORACLE=json.loads((ROOT/'test/expected-native.json').read_text(),parse_float=Decimal)
COLOR=re.compile(r'color\(\s*(\[[^\]]+\])\s*\)')
def load(value):return json.loads(value,parse_float=Decimal)
def inspect_csg(text):
 colors=[load(m)for m in COLOR.findall(text)]
 matrices=[load(m)for m in re.findall(r'multmatrix\(\s*(\[.*?\])\s*\)',text,re.S)]
 cubes=[(load(size),center=='true')for size,center in re.findall(r'cube\(\s*size\s*=\s*(\[[^\]]+\]),\s*center\s*=\s*(true|false)\s*\)',text)]
 return colors,matrices,cubes

def check(csg,log,mode):
 colors,matrices,cubes=inspect_csg(csg)
 expected_colors=ORACLE[{'original':'originalColors','edited':'editedColors','wrong-arity':'fallbackColors','json-array':'fallbackColors','other-original':'otherColors','other-edited':'otherColors'}[mode]]
 assert colors==expected_colors,f'Native {mode} colors mismatch: {colors}'
 other=mode.startswith('other-');width=ORACLE['otherWidth']if other else ORACLE['width'];positions=ORACLE['otherTranslations']if other else ORACLE['translations']
 expected_matrices=[[[1,0,0,x],[0,1,0,y],[0,0,1,z],[0,0,0,1]]for x,y,z in positions]
 assert matrices==expected_matrices,f'Native {mode} geometry translations changed: {matrices}'
 assert cubes==[([width,2,1],False)]*3,f'Native {mode} cube sizes changed: {cubes}'
 echoes={}
 for key,value in re.findall(r'^ECHO:\s*"PT_([A-Z]+)",\s*(.+)$',log,re.M):
  assert key not in echoes,'Duplicate fixture echo';echoes[key]=load(value)
 expected_hex='#ffffff'if other else '#000000'if mode=='original'else '#ff0000'
 expected_rgb=[1,0,1]if other else [Decimal('.25'),Decimal('.5'),Decimal('.75')]if mode=='original'else [Decimal('.2'),Decimal('.3'),Decimal('.4')]if mode in ['wrong-arity','json-array']else [0,1,0]
 expected_rgba=[0,1,1,Decimal('.75')]if other else [Decimal('.5'),Decimal('.25'),Decimal('.75'),Decimal('.25')]if mode=='original'else [0,0,1,Decimal('.5')]
 expected_echo={'HEX':expected_hex,'RGB':expected_rgb,'RGBA':expected_rgba,'WIDTH':width,'POSITION':positions[1]}
 assert echoes==expected_echo,f'Native {mode} echoes mismatch: {echoes}'
 return {'mode':mode,'colors':colors,'matrices':matrices,'cubeSizes':[size for size,_ in cubes],'echoes':echoes}

def reject_positive(csg):
 actual=inspect_csg(csg)[0];assert actual!=ORACLE['editedColors'],'Fault control was accepted as correct colors';return actual

def geometry_signature(csg):return re.sub(r'\s+','',COLOR.sub('color(<selected-material>)',csg))
