#!/usr/bin/env python3
"""Q1.6: fix Qwerty's skin bind-space without changing its visible rest pose."""
import argparse, json, math, struct
from pathlib import Path

N={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
T={5126:'f',5123:'H',5125:'I'}

def load(path):
    data=Path(path).read_bytes()
    assert data[:4]==b'glTF' and struct.unpack_from('<I',data,4)[0]==2
    jlen=struct.unpack_from('<I',data,12)[0]
    meta=json.loads(data[20:20+jlen])
    off=20+jlen;blen,kind=struct.unpack_from('<I4s',data,off)
    assert kind==b'BIN\0'
    return meta,bytearray(data[off+8:off+8+blen])

def rows(meta,b,aid):
    a=meta['accessors'][aid];v=meta['bufferViews'][a['bufferView']]
    start=v.get('byteOffset',0)+a.get('byteOffset',0)
    fmt='<'+T[a['componentType']]*N[a['type']];step=struct.calcsize(fmt)
    return [(start+i*step,struct.unpack_from(fmt,b,start+i*step)) for i in range(a['count'])]

def rest_positions(nodes):
    parent={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
    cache={}
    def walk(i):
        if i not in cache:
            node=nodes[i]
            assert all(abs(x)<1e-7 for x in node.get('rotation',[0,0,0,1])[:3])
            p=walk(parent[i]) if i in parent else (0,0,0)
            cache[i]=tuple(x+y for x,y in zip(node.get('translation',[0,0,0]),p))
        return cache[i]
    return [walk(i) for i in range(len(nodes))]

def audit(meta,b):
    joints=meta['skins'][0]['joints'];rest=rest_positions(meta['nodes'])
    mats=rows(meta,b,meta['skins'][0]['inverseBindMatrices'])
    assert len(joints)==len(mats)==19
    errors={}
    for i,(node,(_,mat)) in enumerate(zip(joints,mats)):
        errors[meta['nodes'][node]['name']]=max(abs(mat[12+k]+rest[node][k]) for k in range(3))
    for p in meta['meshes'][0]['primitives']:
        a=p['attributes']
        assert set(('POSITION','NORMAL','TEXCOORD_0','WEIGHTS_0','JOINTS_0'))<=set(a)
        pos=rows(meta,b,a['POSITION']);uv=rows(meta,b,a['TEXCOORD_0'])
        wt=rows(meta,b,a['WEIGHTS_0']);joint=rows(meta,b,a['JOINTS_0'])
        ind=rows(meta,b,p['indices'])
        assert len(pos)==len(uv)==len(wt)==len(joint)
        assert len(ind)%3==0
        assert all(0<=x[0]<len(pos) for _,x in ind)
        for (_,x),(_,w),(_,j) in zip(uv,wt,joint):
            assert all(math.isfinite(z) and -1e-4<=z<=1.0001 for z in x)
            assert abs(sum(w)-1)<1e-5
            assert all(j[k]<len(joints) for k,weight in enumerate(w) if weight>1e-5)
    return errors

def repair(source,dest):
    m,b=load(source);nodes=m['nodes'];joints=m['skins'][0]['joints']
    assert nodes[4]['name']=='base_plate' and nodes[5]['name']=='skull_upper'
    delta=nodes[4]['translation'][2]
    assert abs(delta-.475)<1e-5
    descendants={4,5,18,19}
    assert {18,19}<=set(nodes[5]['children'])
    moving={i for i,n in enumerate(joints) if n in descendants}
    before=audit(m,b)
    assert {name for name,e in before.items() if e>.4}=={'base_plate','skull_upper','eyelidL','eyelidR'}
    rest=rest_positions(nodes)
    for index,(off,mat) in enumerate(rows(m,b,m['skins'][0]['inverseBindMatrices'])):
        if joints[index] in descendants:
            for axis in range(3):
                location=off+(12+axis)*4
                expected=-rest[joints[index]][axis]
                old_value=struct.unpack_from('<f',b,location)[0]
                # Preserve the original sign bit of exact zero. Signed zero
                # affects GLB hashes, not the resulting transform.
                if expected==0 and old_value==0: continue
                struct.pack_into('<f',b,location,expected)
    updated=0
    for p in m['meshes'][0]['primitives']:
        a=p['attributes'];pos=rows(m,b,a['POSITION'])
        skin=rows(m,b,a['JOINTS_0']);wt=rows(m,b,a['WEIGHTS_0'])
        for (off,v),(_,j),(_,w) in zip(pos,skin,wt):
            assert abs(w[0]-1)<1e-5 and sum(abs(x) for x in w[1:])<1e-5
            if j[0] in moving:
                struct.pack_into('<f',b,off+8,v[2]+delta);updated+=1
        pacc=m['accessors'][a['POSITION']]
        after=[x for _,x in rows(m,b,a['POSITION'])]
        if 'min' in pacc:pacc['min']=[min(v[i] for v in after) for i in range(3)]
        if 'max' in pacc:pacc['max']=[max(v[i] for v in after) for i in range(3)]
    assert updated==840
    assert max(audit(m,b).values())<1e-5
    assert len(m['animations'])==6
    m['asset'].setdefault('extras',{})['qwertyRigQ16']={
        'step':'Q1.6','repair':'rest-space skinning inverse bind matrices',
        'offsetZ':delta,'headJointNodes':sorted(descendants),
        'affectedVertices':updated,'allBindErrorsBelow':1e-5,
        'preserves':['visible centered head','UVs','vertex counts',
                     'flat eyes and separate lids','six animations']}
    m['buffers'][0]['byteLength']=len(b)
    j=json.dumps(m,separators=(',',':'),ensure_ascii=True).encode()
    j+=b' '*((-len(j))%4)
    b+=b'\0'*((-len(b))%4)
    raw=b'glTF'+struct.pack('<II',2,12+8+len(j)+8+len(b))
    raw+=struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(b),b'BIN\0')+b
    dest=Path(dest);dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(raw)
    print('Q1.6 repaired',updated,'vertices and 4 bind matrices;',len(raw),'bytes')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('destination')
    a=p.parse_args();repair(a.source,a.destination)
