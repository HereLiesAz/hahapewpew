#!/usr/bin/env python3
"""Owner's proportional correction: Shift circle-from-above dome and matched torso.

Source is the immutable S2.7 or S2.8 candidate; output also serves the published
Shift path. Only head-assigned POSITION and NORMAL vertices are modified.
Use --dome-rise-ratio for the later shallow-wok correction; this intentionally
supersedes the historical 92% standing-height target. The 16-bone skin, all
old motion clips, UVs, skin weights and non-head mesh bytes
are retained. Qwerty is NOT rewritten; scale him to .27 in character-models.js.
"""
import argparse
import json
import math
import struct
from pathlib import Path

QWERTY_ROOT_SCALE = .27
SHIFT_ROOT_SCALE = .46
SHIFT_OVER_QWERTY_HEIGHT = .92
EXPECTED_HEAD_VERTICES = 9504
EXPECTED_NON_HEAD_VERTICES = 1740
HEAD_PARTS = frozenset({
    'Shift/Dome_Graphite','Shift/Dome_Side',
    'Shift/Ink_Outline','Shift/Eyes_2D_Emission',
})


def read_glb(path):
    raw = path.read_bytes()
    if raw[:4] != b'glTF' or struct.unpack_from('<II',raw,4) != (2,len(raw)):
        raise ValueError('Not a complete glTF 2.0 GLB')
    json_size,typ=struct.unpack_from('<I4s',raw,12)
    if typ!=b'JSON':
        raise ValueError('No glTF JSON chunk')
    meta=json.loads(raw[20:20+json_size])
    size,kind=struct.unpack_from('<I4s',raw,20+json_size)
    if kind!=b'BIN\0' or 28+json_size+size!=len(raw):
        raise ValueError('Unexpected GLB binary layout')
    return meta,bytearray(raw[28+json_size:])


def write_glb(meta,data,target):
    encoded=json.dumps(meta,separators=(',', ':'),ensure_ascii=True).encode('ascii')
    encoded+=b' '*(-len(encoded)%4)
    output=(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(data))
            +struct.pack('<I4s',len(encoded),b'JSON')+encoded
            +struct.pack('<I4s',len(data),b'BIN\0')+data)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(output)


def build(source:Path,qwerty:Path,target:Path,*,dome_rise_ratio=None):
    if dome_rise_ratio is not None and (not math.isfinite(dome_rise_ratio) or not 0 < dome_rise_ratio < .5):
        raise ValueError('Shallow cap rise/diameter must be between zero and one half')
    gltf,data=read_glb(source)
    qmeta,_=read_glb(qwerty)
    if 'shiftSequencesS27' not in gltf['asset'].get('extras',{}):
        raise ValueError('S2.7 five-clip skinned source required')
    names=[a['name'] for a in gltf['animations']]
    if names!=['Shift_Walk','Shift_Idle','Shift_Talk','Shift_Turn','Shift_Weapon']:
        raise ValueError('Unexpected Shift clips')
    skin=gltf['skins'][0]
    if len(skin['joints'])!=16:
        raise ValueError('Unexpected Shift joint topology')
    head_node=next(i for i,n in enumerate(gltf['nodes']) if n['name']=='head')
    head_joint=skin['joints'].index(head_node)
    if head_joint!=3:
        raise ValueError('Unrecognized Shift head joint')
    floor=-next(n['translation'][1] for n in gltf['nodes']
                if n['name']=='Shift.S24.GroundAlign')
    qtop=max(qmeta['accessors'][p['attributes']['POSITION']]['max'][1]
             for mesh in qmeta['meshes'] for p in mesh['primitives'])
    materials=gltf['materials']
    primitives=gltf['meshes'][0]['primitives']

    def part(name):
        return next(p for p in primitives
                    if materials[p['material']]['name']==name)

    def accessor(p,key,component,shape):
        item=gltf['accessors'][p['attributes'][key]]
        view=gltf['bufferViews'][item['bufferView']]
        if item['componentType']!=component or item['type']!=shape or view.get('byteStride'):
            raise ValueError('Unsupported Shift vertex format')
        start=view.get('byteOffset',0)+item.get('byteOffset',0)
        stride=12 if shape=='VEC3' else 8
        if start+stride*item['count']>len(data):
            raise ValueError('Truncated glTF accessor')
        return item,start

    dome=part('Shift/Dome_Side')
    pos,point_offset=accessor(dome,'POSITION',5126,'VEC3')
    rings={}
    for i in range(pos['count']):
        x,y,z=struct.unpack_from('<fff',data,point_offset+12*i)
        key=round(y,5)
        ring=rings.setdefault(key,{'y':y,'rx':0,'rz':0})
        ring['rx']=max(ring['rx'],abs(x))
        ring['rz']=max(ring['rz'],abs(z))
    ordered=sorted(rings.values(),key=lambda p:p['y'])
    if len(ordered)!=11:
        raise ValueError('Expected 11 concentric dome rings')
    base,top=ordered[0]['y'],ordered[-1]['y']
    new_top=(base+2*ordered[0]['rx']*dome_rise_ratio if dome_rise_ratio is not None
             else floor+qtop*QWERTY_ROOT_SCALE*SHIFT_OVER_QWERTY_HEIGHT/SHIFT_ROOT_SCALE)
    height_scale=(new_top-base)/(top-base)

    def ratio(y):
        if y<=base:
            r=ordered[0]
            return r['rx']/r['rz']
        if y>=top:
            r=ordered[-1]
            return r['rx']/r['rz']
        for lo,hi in zip(ordered,ordered[1:]):
            if y<=hi['y']:
                t=(y-lo['y'])/(hi['y']-lo['y'])
                rx=lo['rx']+t*(hi['rx']-lo['rx'])
                rz=lo['rz']+t*(hi['rz']-lo['rz'])
                return rx/rz
        raise ValueError('Dome height outside ring interpolation')

    altered=0
    untouched=0
    for primitive in primitives:
        name=materials[primitive['material']]['name']
        positions,po=accessor(primitive,'POSITION',5126,'VEC3')
        normals,no=accessor(primitive,'NORMAL',5126,'VEC3')
        joints,jo=accessor(primitive,'JOINTS_0',5123,'VEC4')
        if not (positions['count']==normals['count']==joints['count']):
            raise ValueError('Unmatched Shift primitive buffers')
        if positions['count']%3:
            raise ValueError('Expected triangle-soup geometry')

        for i in range(positions['count']):
            joint=struct.unpack_from('<H',data,jo+8*i)[0]
            if joint!=head_joint:
                untouched+=1
                continue
            if name not in HEAD_PARTS:
                raise ValueError('Unrecognized head geometry')
            x,y,z=struct.unpack_from('<fff',data,po+12*i)
            # Do not alter X: frontal width and body proportions stay fixed.
            # Each original horizontal elliptic ring becomes a CIRCLE,
            # including the continuous back shell, face graphic and rim.
            struct.pack_into('<fff',data,po+12*i,x,
                             base+(y-base)*height_scale,z*ratio(y))
            altered+=1

        for i in range(0,positions['count'],3):
            is_head=[struct.unpack_from('<H',data,jo+8*(i+j))[0]==head_joint
                     for j in range(3)]
            if not any(is_head):
                continue
            if not all(is_head):
                raise ValueError('Mixed head/body triangle attachment')
            a,b,c=[struct.unpack_from('<fff',data,po+12*(i+j)) for j in range(3)]
            u=[b[k]-a[k] for k in range(3)]
            v=[c[k]-a[k] for k in range(3)]
            cross=(u[1]*v[2]-u[2]*v[1],
                   u[2]*v[0]-u[0]*v[2],
                   u[0]*v[1]-u[1]*v[0])
            magnitude=math.sqrt(sum(x*x for x in cross))
            if magnitude<1e-8:
                raise ValueError('Invalid head triangle after correction')
            for j in range(3):
                struct.pack_into('<fff',data,no+12*(i+j),
                                 *(v/magnitude for v in cross))
        points=[struct.unpack_from('<fff',data,po+12*i)
                for i in range(positions['count'])]
        positions['min']=[min(p[k] for p in points) for k in range(3)]
        positions['max']=[max(p[k] for p in points) for k in range(3)]

    if altered!=EXPECTED_HEAD_VERTICES or untouched!=EXPECTED_NON_HEAD_VERTICES:
        raise ValueError(f'Unexpected altered/unchanged vertex counts: {altered}/{untouched}')

    # Validate every vertex on every shell ring, not just the X and Z bounds.
    updated,offset=accessor(dome,'POSITION',5126,'VEC3')
    shell_rings={}
    for i in range(updated['count']):
        x,y,z=struct.unpack_from('<fff',data,offset+12*i)
        shell_rings.setdefault(round(y,5),[]).append(math.hypot(x,z))
    if len(shell_rings)!=11:
        raise ValueError('Lost a dome ring during correction')
    max_circular_error=max(max(rr)-min(rr) for rr in shell_rings.values())
    if max_circular_error>2e-6:
        raise ValueError('Dome is still elliptical in top view')
    bodyQ=.6*QWERTY_ROOT_SCALE
    bodyS=(.8852148652076721-.5357768535614014)*SHIFT_ROOT_SCALE
    if abs(bodyQ-bodyS)/bodyQ>.02:
        raise ValueError('Robot torso heights diverge')
    profile='shiftDomeS29' if dome_rise_ratio is not None else 'shiftDomeS28'
    gltf['asset'].setdefault('extras',{})[profile]={
        'step':'S2.9-shallow-wok' if dome_rise_ratio is not None else 'S2.8-owner-correction',
        'source':str(source),
        'reference':('owner: shallow upside-down wok, circular overhead, unchanged body'
                     if dome_rise_ratio is not None else 'owner 2026-10-26 top-circle, matched torsos, 92% height'),
        'domeRiseOverDiameter':dome_rise_ratio,
        'ringCount':11, 'circularMaxRadiusError':max_circular_error,
        'baseY':base,'oldTop':top,'newTop':new_top,'yScale':height_scale,
        ('measuredRelativeHeight' if dome_rise_ratio is not None else 'targetRelativeHeight'):
            (new_top-floor)*SHIFT_ROOT_SCALE/(qtop*QWERTY_ROOT_SCALE),
        'oldQwertyRootScale':.54,'newQwertyRootScale':QWERTY_ROOT_SCALE,
        'shiftRootScale':SHIFT_ROOT_SCALE,
        'qwertyBodyWorldHeight':bodyQ,'shiftBodyWorldHeight':bodyS,
        'modifiedHeadVertices':altered,'skinJoint':head_joint,
        'untouchedNonHeadVertices':untouched,
        'preserved':['Qwerty GLB','Shift torso and limbs','head-bound graphics',
                     '16-joint rig','all UVs and weights','five animation clips'],
    }
    write_glb(gltf,data,target)
    return altered,max_circular_error,new_top


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('shift',type=Path)
    parser.add_argument('qwerty',type=Path)
    parser.add_argument('destination',type=Path)
    parser.add_argument('--dome-rise-ratio',type=float,default=None,
                        help='Shallow cap rise/diameter; supersedes the historical 92%% height target')
    args=parser.parse_args()
    print(build(args.shift,args.qwerty,args.destination,dome_rise_ratio=args.dome_rise_ratio))
