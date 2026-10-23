#!/usr/bin/env python3
"""Align complete Qwerty head/plate above cylindrical torso, preserving mesh and animation."""
import argparse, json, struct
from pathlib import Path
def read_glb(path):
    buf=Path(path).read_bytes()
    if buf[:4]!=b'glTF' or struct.unpack_from('<I',buf,4)[0]!=2:raise ValueError('Expected GLB 2.0')
    size,tag=struct.unpack_from('<I4s',buf,12)
    if tag!=b'JSON':raise ValueError('Missing JSON')
    meta=json.loads(buf[20:20+size])
    offset=20+size
    n,kind=struct.unpack_from('<I4s',buf,offset)
    if kind!=b'BIN\0':raise ValueError('Missing BIN')
    return meta,buf[offset+8:offset+8+n]
def build(source,dest):
    m,b=read_glb(source);n=m['nodes']
    assert n[2]['name']=='spine' and n[3]['name']=='neck'
    assert n[4]['name']=='base_plate' and n[5]['name']=='skull_upper'
    assert 5 in n[4]['children'] and {18,19}.issubset(n[5]['children'])
    assert len(m['skins'][0]['joints'])==19 and len(m['animations'])==4
    f=m['asset']['extras']['qwertyDepthBounce']
    front,back=float(f['frontZ']),float(f['backZ'])
    assert front>0>back and front-back>1
    assert abs(n[4]['translation'][2])<1e-4
    z=round(-(front+back)/2,6)
    n[4]['translation'][2]=z
    assert abs((front+back)/2+z)<1e-5
    m['asset']['extras']['qwertyCenteredHead']={
        'phase':'Q1.4 partial — depth centering only',
        'headPlateBone':'base_plate','bodyCenterZ':0,'headCenterZ':0,
        'plateTranslationZ':z,
        'effectiveFrontZ':round(front+z,6),'effectiveBackZ':round(back+z,6),
        'preserves':['cylindrical torso','very short neck','head dimensions',
        'vertical speech bounce','stationary bottom plate',
        'flat eyes and eyelids','rigged geometry','4 clips']}
    j=json.dumps(m,separators=(',',':'),ensure_ascii=True).encode('utf8')
    j+=b' '*((-len(j))%4)
    if len(b)%4:raise ValueError('Misaligned BIN')
    output=b'glTF'+struct.pack('<II',2,12+8+len(j)+8+len(b))
    output+=struct.pack('<I4s',len(j),b'JSON')+j
    output+=struct.pack('<I4s',len(b),b'BIN\0')+b
    path=Path(dest);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(output)
    print('Centered depth: plate translation z=',z,'body center z=0')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('dest',type=Path);a=p.parse_args()
    build(a.source,a.dest)
