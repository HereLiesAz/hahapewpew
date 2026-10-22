#!/usr/bin/env python3
"""Acceptance checks for Q1.2: the GLB candidate head shape, not live installation."""
import json,struct
from pathlib import Path
import sys
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from qwerty_head_geometry import unpack,COMPONENTS,SIZE

def arr(doc,binary,index):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
 return np.frombuffer(binary,dtype=COMPONENTS[a['componentType']][0],count=a['count']*SIZE[a['type']],offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],SIZE[a['type']])

def run(path):
 m,b=unpack(path)
 assert len(m['skins'][0]['joints'])==19
 assert [a['name'] for a in m['animations']]==['Qwerty_Talk_Flap','Qwerty_Walk','Qwerty_Idle','Qwerty_Suspicious_Lids']
 assert m['nodes'][4]['name']=='base_plate' and m['nodes'][5]['name']=='skull_upper'
 front=m['meshes'][0]['primitives'][0]
 points=arr(m,b,front['attributes']['POSITION'])
 assert len(points)==6,'Head front must be exactly one uninterrupted quadrilateral'
 bounds=(points[:,0].min(),points[:,0].max(),points[:,1].min(),points[:,1].max())
 ratio=(bounds[1]-bounds[0])/(bounds[3]-bounds[2]);assert 1.68<ratio<1.81,(bounds,ratio)
 assert np.allclose(points[:,2],0.300)
 assert np.isclose(bounds[2],1.16) and np.isclose(bounds[3],2.62)
 # Side plate remains a tangible 0.6-m-deep structure.
 side=m['meshes'][0]['primitives'][1]
 sidepoints=arr(m,b,side['attributes']['POSITION'])
 assert sidepoints[:,2].min()<=-.30 and sidepoints[:,2].max()>=.30
 eye=m['meshes'][0]['primitives'][6];eyes=arr(m,b,eye['attributes']['POSITION'])
 assert 1.62<=eyes[:,1].min() and eyes[:,1].max()<=2.12
 assert np.isfinite(eyes).all()
 for p in m['meshes'][0]['primitives']:
  attrib=p['attributes'];n=m['accessors'][attrib['POSITION']]['count'];joint=arr(m,b,attrib['JOINTS_0']);weights=arr(m,b,attrib['WEIGHTS_0'])
  idx=arr(m,b,p['indices']).reshape(-1)
  assert idx.max()<n and idx.min()>=0
  assert np.allclose(weights.sum(axis=1),1), 'Skin weights normalized'
  assert np.max(joint)<19
 print('PASS Q1.2: one unbroken trapezoid, ratio %.3f, depth, eyes, 19 bones, 4 clips, indices/weights'%ratio)

if __name__=='__main__':run(Path(__file__).resolve().parents[1] / 'workbench/qwerty/Qwerty_Q12.glb')
