#!/usr/bin/env python3
"""Rebuild Qwerty's graphic eyes: larger flat whites with thick black eyelid-rims.

The rims ARE the eyelids. Their semicircular black skin shutters live behind
the face at rest; individual lid bones lower the shutters over white eye discs.
No separate eyebrows, eyeballs, pupils, or second head articulation.
"""
import argparse,json,math,struct
from pathlib import Path
def read(path):
 raw=Path(path).read_bytes()
 assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,4)[0]==2
 jlen=struct.unpack_from('<I',raw,12)[0];m=json.loads(raw[20:20+jlen])
 pos=20+jlen;length,tag=struct.unpack_from('<I4s',raw,pos);assert tag==b'BIN\0'
 return m,bytearray(raw[pos+8:pos+8+length])
SIZE={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
FORMATS={5126:('f',4),5123:('H',2),5125:('I',4)}
ATTR=['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']
def get(m,b,index):
 a=m['accessors'][index];v=m['bufferViews'][a['bufferView']]
 c,n=FORMATS[a['componentType']],SIZE[a['type']]
 base=v.get('byteOffset',0)+a.get('byteOffset',0);fmt='<'+c[0]*n
 return [list(x) for x in struct.iter_unpack(fmt,b[base:base+a['count']*c[1]*n])]
def put(m,b,rows,ctype,typ):
 while len(b)%4:b.append(0)
 fmt='<'+FORMATS[ctype][0]*SIZE[typ];pos=len(b)
 for row in rows:b.extend(struct.pack(fmt,*row))
 m['bufferViews'].append({'buffer':0,'byteOffset':pos,'byteLength':len(b)-pos})
 a={'bufferView':len(m['bufferViews'])-1,'componentType':ctype,'count':len(rows),'type':typ}
 if typ=='VEC3' and ctype==5126:
  a['min']=[min(row[k] for row in rows) for k in range(3)]
  a['max']=[max(row[k] for row in rows) for k in range(3)]
 m['accessors'].append(a)
 return len(m['accessors'])-1
def batch(m,b,p):
 return {'data':{name:get(m,b,p['attributes'][name]) for name in ATTR},
         'indices':[int(x[0]) for x in get(m,b,p['indices'])]}
def empty():
 return {'data':{n:[] for n in ATTR},'indices':[]}
def tri(batch,vertices,bone,cx,cy,radius):
 for x,y,z in vertices:
  a=batch['data']
  a['POSITION'].append([x,y,z]);a['NORMAL'].append([0,0,1])
  a['TEXCOORD_0'].append([.5+(x-cx)/(radius*2),.5+(y-cy)/(radius*2)])
  a['JOINTS_0'].append([bone,0,0,0]);a['WEIGHTS_0'].append([1,0,0,0])
  batch['indices'].append(len(a['POSITION'])-1)
def disk(b,cx,cy,r,z,bone,parts=32):
 for i in range(parts):
  t=2*math.pi*i/parts;u=2*math.pi*(i+1)/parts
  tri(b,[(cx,cy,z),(cx+r*math.cos(t),cy+r*math.sin(t),z),
         (cx+r*math.cos(u),cy+r*math.sin(u),z)],bone,cx,cy,r)
def eyelid(b,cx,cy,r,z,bone,parts=20):
 for i in range(parts):
  t=math.pi*i/parts;u=math.pi*(i+1)/parts
  tri(b,[(cx,cy,z),(cx+r*math.cos(t),cy+r*math.sin(t),z),
         (cx+r*math.cos(u),cy+r*math.sin(u),z)],bone,cx,cy,r)
def build(source,dest):
 m,b=read(source);prims=m['meshes'][0]['primitives'];skin=m['skins'][0]['joints']
 assert [m['materials'][prims[i]['material']]['name'] for i in (2,6,7)]==[
  'Qwerty/Outline','Qwerty/Eyes_2D_Emission','Qwerty/Eyelid_2D']
 assert [skin.index(i) for i in (5,18,19)]==[4,17,18]
 rings=batch(m,b,prims[2]);coords=rings['data']['POSITION']
 keep=[]
 for i in range(0,len(rings['indices']),3):
  indexes=rings['indices'][i:i+3]
  if all(abs(coords[j][2]-.315)<.0006 and 1.4<coords[j][1]<2.3 for j in indexes):continue
  keep.extend(indexes)
 assert len(rings['indices'])-len(keep)==240,'old eye rings not identified'
 rings['indices']=keep
 eyes=empty();caps=empty()
 for x,bone in ((-.45,17),(.45,18)):
  disk(rings,x,1.87,.418,.315,4)
  disk(eyes,x,1.87,.325,.321,4)
  eyelid(caps,x,2.21,.418,.28,bone)
 for i,part in ((2,rings),(6,eyes),(7,caps)):
  formats={'POSITION':(5126,'VEC3'),'NORMAL':(5126,'VEC3'),
   'TEXCOORD_0':(5126,'VEC2'),'JOINTS_0':(5123,'VEC4'),
   'WEIGHTS_0':(5126,'VEC4')}
  prims[i]['attributes']={name:put(m,b,part['data'][name],*form) for name,form in formats.items()}
  prims[i]['indices']=put(m,b,[[j] for j in part['indices']],5125,'SCALAR')
 m['materials'][prims[7]['material']]['pbrMetallicRoughness']['baseColorFactor']=list(
  m['materials'][prims[2]['material']]['pbrMetallicRoughness']['baseColorFactor'])
 m['asset']['extras']['qwertyEyesQ15Correction']={
  'step':'Q1.5 correction','reason':"owner's four new graphic eyelid references",
  'whiteRadius':.325,'blackRimRadius':.418,'blackRimWidth':.093,
  'eyesEqualSize':True,'flatEyesZ':.321,'rimsZ':.315,'neutralCapsZ':.28,
  'activeCapsZ':.325,
  'eyelidGeometry':'upper semicircular black shutter, same ink as heavy ring; retracts behind head in neutral and descends over white',
  'independentLidBones':['eyelidL','eyelidR'],
  'retains':'red kill state via white emissive eye material runtime recolor','noPupils':True}
 m['buffers'][0]['byteLength']=len(b)
 while len(b)%4:b.append(0)
 j=json.dumps(m,separators=(',',':'),ensure_ascii=True).encode()
 j+=b' '*((-len(j))%4)
 payload=b'glTF'+struct.pack('<II',2,12+8+len(j)+8+len(b))
 payload+=struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(b),b'BIN\0')+b
 p=Path(dest);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(payload)
 print('Q1.5 eye-rims',len(payload),'bytes',len(m['animations']),'animations')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('destination')
 a=p.parse_args();build(a.source,a.destination)
