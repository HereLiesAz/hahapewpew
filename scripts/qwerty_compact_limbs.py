#!/usr/bin/env python3
"""Q1.4 reproducible limb fit: after Q1.3 bounce and Q1.4 head centering."""
import argparse,json,struct
from pathlib import Path
def read(src):
 b=bytearray(Path(src).read_bytes());n=struct.unpack_from('<I',b,12)[0]
 m=json.loads(b[20:20+n]);start=20+n
 l=struct.unpack_from('<I',b,start)[0]
 return m,bytearray(b[start+8:start+8+l])
def access(m,k):
 a=m['accessors'][k];return m['bufferViews'][a['bufferView']].get('byteOffset',0)+a.get('byteOffset',0)
def build(src,dst):
 m,b=read(src);nodes=m['nodes'];names=[n.get('name','') for n in nodes]
 assert nodes[names.index('base_plate')]['translation'][2]==.475
 adj={'elbow.L':(.025,.035,0),'wrist.L':(.05,.035,0),'elbow.R':(-.025,.035,0),'wrist.R':(-.05,.035,0),'knee.L':(0,.035,0),'ankle.L':(0,.035,0),'knee.R':(0,.035,0),'ankle.R':(0,.035,0)}
 for name,d in adj.items():
  node=nodes[names.index(name)]
  node['translation']=[round(x+y,6) for x,y in zip(node['translation'],d)]
 parent={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
 def pivot(i):
  here=nodes[i].get('translation',[0,0,0]);up=pivot(parent[i]) if i in parent else [0,0,0]
  return [x+y for x,y in zip(here,up)]
 skin=m['skins'][0];joints=skin['joints']
 prim=next(p for p in m['meshes'][0]['primitives'] if m['materials'][p['material']]['name']=='Qwerty/Limb_Black')
 posid=prim['attributes']['POSITION'];po=access(m,posid);jo=access(m,prim['attributes']['JOINTS_0'])
 verts=[]
 for i in range(m['accessors'][posid]['count']):
  nid=joints[struct.unpack_from('<H',b,jo+i*8)[0]];name=names[nid];side=-1 if name.endswith('.L') else 1
  v=list(struct.unpack_from('<3f',b,po+i*12))
  if name.startswith('elbow.'):
   v[0]-=side*.025;v[1]+=.035
  elif name.startswith('wrist.'):
   v[0]-=side*.075;v[1]+=.07
   p=pivot(nid);v=[p[k]+(v[k]-p[k])*1.63 for k in range(3)]
  elif name.startswith('knee.'):
   v[1]+=.0175-max(0,.225-v[1])*.85
  elif name.startswith('ankle.'):
   v[1]=(v[1]-.125)*2.05;p=pivot(nid)
   v[0]=p[0]+(v[0]-p[0])*1.36
   v[2]=p[2]+(v[2]-p[2])*1.46
  struct.pack_into('<3f',b,po+i*12,*v);verts.append(v)
 m['accessors'][posid]['min']=[min(v[k] for v in verts) for k in range(3)]
 m['accessors'][posid]['max']=[max(v[k] for v in verts) for k in range(3)]
 at=access(m,skin['inverseBindMatrices'])
 for i,nid in enumerate(joints):
  if names[nid] not in adj:continue
  p=pivot(nid)
  for k in range(3):struct.pack_into('<f',b,at+i*64+48+k*4,-p[k])
 m['asset']['extras']['qwertyCompactRig']={'step':'Q1.4','scope':'retain centered cylindrical torso and extremely short neck; compact arms and legs with large clamps and grounded feet','wristGlobalShorteningY':.07,'ankleGlobalShorteningY':.07,'clampScale':1.63,'footScaleX':1.36,'footScaleZ':1.46,'headGeometryChanged':False,'reference':'artist original drawings plus supplied eight-angle Neural4D screenshots'}
 m['buffers'][0]['byteLength']=len(b)
 j=json.dumps(m,separators=(',',':'),ensure_ascii=True).encode()
 j+=b' '*((-len(j))%4)
 payload=b'glTF'+struct.pack('<II',2,12+8+len(j)+8+len(b))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(b),b'BIN\0')+b
 dst=Path(dst);dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(payload)
 print(dst,len(payload),'bytes')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('destination');a=p.parse_args();build(a.source,a.destination)
