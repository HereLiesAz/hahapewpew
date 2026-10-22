#!/usr/bin/env python3
"""Q1.2: correct only Qwerty's trapezoidal upper head, retaining the original armature.

Source: public/assets/characters/Qwerty_Rigged.glb (19-bone candidate).
Output: workbench/qwerty/Qwerty_Q12.glb, NOT the live game asset.
This intentionally does not alter arms, legs, eyelids, speaking hinge or shading.
"""
import argparse, json, struct
from pathlib import Path
import numpy as np

# Metres; base plate of the supplied rig remains at y~1.14.
BOTTOM_Y = 1.16
TOP_Y = 2.62
BOTTOM_HALF = 1.07
TOP_HALF = 1.26
FRONT_Z, BACK_Z = .300, -.300
INK_Z = .312
INK_WIDTH = .020

COMPONENTS = {5126: ('<f4',4), 5123: ('<u2',2), 5125: ('<u4',4)}
SIZE = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def unpack(path):
    data=path.read_bytes()
    assert data[:4]==b'glTF' and struct.unpack_from('<I',data,4)[0]==2, 'Expected glTF 2.0 binary'
    jslen=struct.unpack_from('<I',data,12)[0]
    gltf=json.loads(data[20:20+jslen]); at=20+jslen
    binlen=struct.unpack_from('<I',data,at)[0]
    assert data[at+4:at+8]==b'BIN\0'
    return gltf, bytearray(data[at+8:at+8+binlen])

def build(source,output):
    meta,buf=unpack(source)
    assert meta['nodes'][5]['name']=='skull_upper', 'Not the candidate Qwerty skeleton'
    assert meta['nodes'][4]['name']=='base_plate', 'Stationary bottom plate missing'
    assert len(meta['skins'][0]['joints'])==19
    joints=meta['skins'][0]['joints']; skull=joints.index(5)
    primitives=meta['meshes'][0]['primitives']
    assert len(primitives)==8
    def read_access(idx):
        acc=meta['accessors'][idx]; view=meta['bufferViews'][acc['bufferView']]
        dt,_=COMPONENTS[acc['componentType']]
        start=view.get('byteOffset',0)+acc.get('byteOffset',0)
        return np.frombuffer(buf,dtype=dt,count=acc['count']*SIZE[acc['type']],offset=start).copy().reshape(acc['count'],SIZE[acc['type']])
    def write_access(array,ctype,typ):
        arr=np.ascontiguousarray(array)
        while len(buf)%4:buf.append(0)
        start=len(buf);buf.extend(arr.tobytes())
        meta['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':arr.nbytes})
        info={'bufferView':len(meta['bufferViews'])-1,'componentType':ctype,'count':len(arr),'type':typ}
        if typ=='VEC3' and ctype==5126:
            info['min']=arr.min(0).tolist();info['max']=arr.max(0).tolist()
        meta['accessors'].append(info)
        return len(meta['accessors'])-1
    # Each face is uniquely indexed in the candidate; keep the other materials and
    # vertices byte-for-byte except where the bone is skull_upper and material 0/1/2.
    batches={}
    for mid in (0,1,2):
        prim=primitives[mid]
        attr={k:read_access(a) for k,a in prim['attributes'].items()}
        indices=read_access(prim['indices']).reshape(-1,3)
        kept=[]
        for face in indices:
            # All faces have one rigid joint assignment in this rig.
            if all(int(attr['JOINTS_0'][v,0])==skull for v in face):
                # Eye outlines are flat black graphics, also skinned to the skull.
                # Preserve them verbatim; remove only the old outer perimeter.
                positions=attr['POSITION'][face]
                if mid==2 and np.all(np.abs(positions[:,0])<.74) and np.all((positions[:,1]>1.51)&(positions[:,1]<2.23)):
                    kept.append(face)
                continue
            kept.append(face)
        v=[],[],[],[],[]
        names=['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']
        store={key:[] for key in names}
        for face in kept:
            for i in face:
                for key in names:store[key].append(attr[key][i])
        batches[mid]=store
    def triangle(a,b,c,mid):
        p=np.asarray([a,b,c],dtype=np.float64)
        norm=np.cross(p[1]-p[0],p[2]-p[0]);length=np.linalg.norm(norm)
        if length<1e-9:raise ValueError('Degenerate head triangle')
        norm=norm/length
        for pt in p:
            batches[mid]['POSITION'].append(pt.tolist())
            batches[mid]['NORMAL'].append(norm.tolist())
            batches[mid]['TEXCOORD_0'].append([min(.999,max(0,(pt[0]+1.3)/2.6)),min(.999,max(0,(pt[1]-BOTTOM_Y)/(TOP_Y-BOTTOM_Y)))])
            batches[mid]['JOINTS_0'].append([skull,0,0,0])
            batches[mid]['WEIGHTS_0'].append([1,0,0,0])
    def quad(a,b,c,d,mid):triangle(a,b,c,mid);triangle(a,c,d,mid)
    bottom_left=(-BOTTOM_HALF,BOTTOM_Y);bottom_right=(BOTTOM_HALF,BOTTOM_Y)
    top_right=(TOP_HALF,TOP_Y);top_left=(-TOP_HALF,TOP_Y)
    # Single face covering the ENTIRE trapezoid: no mouth and no split line.
    points=[bottom_left,bottom_right,top_right,top_left]
    f=[(x,y,FRONT_Z) for x,y in points]
    back=[(x,y,BACK_Z) for x,y in points]
    quad(*f,0);quad(back[3],back[2],back[1],back[0],1)
    for i in range(4):
        j=(i+1)%4
        # top and side faces, dark to show the depth of the enclosure
        quad(f[j],f[i],back[i],back[j],1)
    # 2D black line along the front outline only, never across the face.
    for i in range(4):
        a=np.asarray(points[i],dtype=float);b=np.asarray(points[(i+1)%4],dtype=float)
        vec=b-a;normal=np.array([-vec[1],vec[0]])/np.linalg.norm(vec)*INK_WIDTH
        a1=a+normal;a2=a-normal;b1=b+normal;b2=b-normal
        quad((*a1,INK_Z),(*a2,INK_Z),(*b2,INK_Z),(*b1,INK_Z),2)
    for mid,store in batches.items():
        attrs={}
        formats={'POSITION':(np.float32,5126,'VEC3'),'NORMAL':(np.float32,5126,'VEC3'),
            'TEXCOORD_0':(np.float32,5126,'VEC2'), 'JOINTS_0':(np.uint16,5123,'VEC4'),
            'WEIGHTS_0':(np.float32,5126,'VEC4')}
        for name,(dt,ctype,typ) in formats.items():
            attrs[name]=write_access(np.asarray(store[name],dtype=dt),ctype,typ)
        indexes=np.arange(len(store['POSITION']),dtype=np.uint32).reshape(-1,1)
        primitives[mid]['attributes']=attrs
        primitives[mid]['indices']=write_access(indexes,5125,'SCALAR')
    meta['buffers'][0]['byteLength']=len(buf)
    meta.setdefault('asset',{}).setdefault('extras',{})['qwertyGeometry']={
        'step':'Q1.2','head':'one unbroken front trapezoid','topY':TOP_Y,'bottomY':BOTTOM_Y,
        'topHalfWidth':TOP_HALF,'bottomHalfWidth':BOTTOM_HALF,'depth':FRONT_Z-BACK_Z,
        'source':'Original tabshiftqwerty.jpg reference / user geometry corrections'}
    js=json.dumps(meta,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    while len(buf)%4:buf.append(0)
    payload=b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(buf))
    payload+=struct.pack('<I4s',len(js),b'JSON')+js
    payload+=struct.pack('<I4s',len(buf),b'BIN\0')+buf
    output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(payload)
    print(f'Q1.2: {output} ({len(payload)} bytes), source {source}')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('output',type=Path)
    args=p.parse_args();build(args.input,args.output)
