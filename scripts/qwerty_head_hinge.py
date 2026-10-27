#!/usr/bin/env python3
"""Q1.3 — keep the existing flat bottom plate stationary while Qwerty's
entire trapezoidal head opens on its pre-existing rear-edge skull_upper pivot.
No jaw, mouth, face split, added detailing, or changes to the Q1.2 silhouette.
"""
from functools import partial
import argparse
import json
import struct
from pathlib import Path
import numpy as np
from qwerty_head_geometry import unpack, COMPONENTS, SIZE

def read(doc, binary, accessor_id, *, copy=True):
    """Read an accessor; copy by default so generators can resize storage."""
    acc=doc['accessors'][accessor_id]
    view=doc['bufferViews'][acc['bufferView']]
    off=view.get('byteOffset',0)+acc.get('byteOffset',0)
    dtype=COMPONENTS[acc['componentType']][0]
    values=np.frombuffer(binary,dtype=dtype,count=acc['count']*SIZE[acc['type']],offset=off).reshape(acc['count'],SIZE[acc['type']])
    return values.copy() if copy else values

# Historical depth-bounce authoring intentionally mutates the original buffer.
arr = partial(read, copy=False)

def build(source, output):
    meta,buf=unpack(Path(source))
    assert meta['nodes'][4]['name']=='base_plate' and meta['nodes'][5]['name']=='skull_upper'
    joints=meta['skins'][0]['joints']
    assert len(joints)==19
    fixed=joints.index(4)
    moving=joints.index(5)
    prim=meta['meshes'][0]['primitives'][1]
    assert meta['materials'][prim['material']]['name']=='Qwerty/Side_Dark'
    faces=read(meta,buf,prim['indices']).reshape(-1,3)
    positions=read(meta,buf,prim['attributes']['POSITION'])
    weights=read(meta,buf,prim['attributes']['JOINTS_0'])
    keep=[]
    removed=0
    fixed_surface=0
    for tri in faces:
        is_moving_bottom=(np.all(weights[tri,0]==moving) and
                          np.all(np.abs(positions[tri,1]-1.16)<.001))
        if is_moving_bottom:
            removed+=1
        else:
            keep.append(tri.tolist())
            if (np.all(weights[tri,0]==fixed) and
                np.all(np.abs(positions[tri,1]-1.162)<.001)):
                fixed_surface+=1
    assert removed==2 and fixed_surface==2, (removed, fixed_surface)
    # The original rest skeleton, Q1.2 head surfaces, UVs, eye graphics,
    # eyelids and all animation buffers remain byte-for-byte untouched.
    index_data=np.asarray(keep,dtype=np.uint32).ravel().tobytes()
    while len(buf)%4: buf.append(0)
    offset=len(buf)
    buf.extend(index_data)
    meta['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(index_data)})
    meta['accessors'].append({'bufferView':len(meta['bufferViews'])-1,
        'componentType':5125,'count':len(keep)*3,'type':'SCALAR'})
    prim['indices']=len(meta['accessors'])-1
    meta['buffers'][0]['byteLength']=len(buf)
    meta.setdefault('asset',{}).setdefault('extras',{})['qwertyHinge']={
        'step':'Q1.3','fixedPlate':'base_plate','movingHousing':'skull_upper',
        'hinge':'existing rear edge','removedMovingUndersideTriangles':2,
        'faceSplit':False,'mouth':False,
        'preserves':['19 bones','UVs','eyes','eyelids','4 animation clips']}
    js=json.dumps(meta,separators=(',',':')).encode()
    js+=b' '*((-len(js))%4)
    while len(buf)%4: buf.append(0)
    payload=b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(buf))
    payload+=struct.pack('<I4s',len(js),b'JSON')+js
    payload+=struct.pack('<I4s',len(buf),b'BIN\0')+buf
    output=Path(output)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_bytes(payload)
    print('Q1.3: retained %s side triangles, removed 2 moving underside triangles'%len(keep))

if __name__=='__main__':
    cli=argparse.ArgumentParser()
    cli.add_argument('input',type=Path)
    cli.add_argument('output',type=Path)
    a=cli.parse_args()
    build(a.input,a.output)
