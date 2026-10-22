#!/usr/bin/env python3
"""Independent glTF binary structure and skinning checks, no generator imports."""
import json,struct,pathlib
import numpy as np
base=pathlib.Path(__file__).resolve().parents[1]/'public/assets/models'
for name in ('tab','shift','qwerty'):
    blob=(base/(name+'.glb')).read_bytes()
    magic,version,total=struct.unpack_from('<4sII',blob,0)
    assert (magic,version,total)==(b'glTF',2,len(blob))
    n=struct.unpack_from('<I',blob,12)[0]
    g=json.loads(blob[20:20+n]);binstart=20+n+8
    assert len(g['skins'])==1 and len(g['skins'][0]['joints'])>=17
    assert 6<=len(g['meshes'])<=12
    assert len(g['textures'])>=6
    def read(idx):
        a=g['accessors'][idx];v=g['bufferViews'][a['bufferView']]
        count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
        return np.frombuffer(blob,dtype=dtype,count=a['count']*count,offset=binstart+v['byteOffset']+a.get('byteOffset',0)).reshape(-1,count)
    inv=read(g['skins'][0]['inverseBindMatrices'])
    assert np.allclose(inv[:,[3,7,11]],0) and np.allclose(inv[:,15],1),'invalid inverse bone matrices'
    vertices=0;blends=0
    for m in g['meshes']:
        attr=m['primitives'][0]['attributes']
        p=read(attr['POSITION']);uv=read(attr['TEXCOORD_0'])
        weights=read(attr['WEIGHTS_0']);joints=read(attr['JOINTS_0'])
        assert len(p)==len(uv)==len(weights)==len(joints)
        assert np.isfinite(p).all() and np.isfinite(uv).all()
        assert np.allclose(weights.sum(axis=1),1,atol=1e-6)
        assert np.all(joints<len(g['skins'][0]['joints']))
        assert (np.linalg.norm(read(attr['NORMAL']),axis=1)>.9).all()
        assert 0<=uv.min()<=uv.max()<=1.01
        vertices+=len(p);blends+=np.count_nonzero(weights[:,1]>.01)
    assert vertices>=12000,(name,vertices)
    if name=='tab':assert blends>100,'skin weights not blended'
    print(name,vertices,'vertices',len(g['meshes']),'draw calls',blends,'blend vertices')
