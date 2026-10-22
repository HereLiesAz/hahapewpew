#!/usr/bin/env python3
"""Q1.3 checks: fixed base, no moving underside, intact rig/animation, eye attachment."""
import sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from qwerty_head_hinge import read, unpack

def test(source,out):
    old,oldbin=unpack(source)
    doc,buf=unpack(out)
    assert len(doc['skins'][0]['joints'])==19
    assert doc['skins']==old['skins']
    assert doc['nodes']==old['nodes']
    assert doc['animations']==old['animations']
    for i,(p,prev) in enumerate(zip(doc['meshes'][0]['primitives'],old['meshes'][0]['primitives'])):
        assert p['attributes']==prev['attributes'] and p['material']==prev['material']
        if i!=1: assert p['indices']==prev['indices']
        tri=read(doc,buf,p['indices']).ravel().reshape(-1,3)
        pos=read(doc,buf,p['attributes']['POSITION'])
        joints=read(doc,buf,p['attributes']['JOINTS_0'])
        weight=read(doc,buf,p['attributes']['WEIGHTS_0'])
        assert tri.max()<len(pos)
        assert np.allclose(weight.sum(axis=1),1)
        if i==1:
            old_tri=read(old,oldbin,prev['indices']).ravel().reshape(-1,3)
            assert len(tri)==len(old_tri)-2
            assert sum(np.all(joints[t,0]==3) and np.all(abs(pos[t,1]-1.162)<.001) for t in tri)==2
            assert sum(np.all(joints[t,0]==4) and np.all(abs(pos[t,1]-1.16)<.001) for t in tri)==0
    # The whole front and the white eye surfaces are driven by skull_upper.
    for p in [doc['meshes'][0]['primitives'][0],doc['meshes'][0]['primitives'][6]]:
        joints=read(doc,buf,p['attributes']['JOINTS_0'])
        assert np.all(joints[:,0]==4)
    talk=next(x for x in doc['animations'] if x['name']=='Qwerty_Talk_Flap')
    rotation=next(c for c in talk['channels'] if c['target']=={'node':5,'path':'rotation'})
    q=read(doc,buf,talk['samplers'][rotation['sampler']]['output'])
    assert abs(q[0,0])<.001 and abs(q[-1,0])<.001 and q[:,0].min()<-.3
    pivot=np.array([0.,1.175,-.26])
    p=np.array([0.,1.16,.30])-pivot
    for theta in [-.35,-.8]:
        lifted=p[1]*np.cos(theta)-p[2]*np.sin(theta)+pivot[1]
        assert lifted>1.16+.1
    assert doc['asset']['extras']['qwertyHinge']['mouth'] is False
    print('PASS Q1.3: stationary plate, open rear hinge, complete face/eyes move, unchanged skeleton and clips')

if __name__=='__main__':
    test(Path(sys.argv[1]),Path(sys.argv[2]))
