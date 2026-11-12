#!/usr/bin/env python3
"""Combine Rex Mun's rigged Victoria body with the *unaltered* authored Tab outfit.

The original Tab GLB stays the independently-tested fallback. This exporter
replaces only the Tab/Skin primitive in a separate candidate; dress, tears,
cardboard art, bear and shoes retain their original vertices, UVs and materials.
Uses the official Blendkit GLB and independently Draco-decoded source attributes.
"""
import argparse
import copy
import hashlib
import io
import json
import math
from pathlib import Path
import struct

import numpy as np
from PIL import Image

ASSET_ID = '1fcc4446-1992-48ec-a160-9cd73ee35158'
SOURCE_SHA256 = 'ba3853fe4c68f613a69240c4de782b931b9730adfd94049242afd2e94ed89eca'
SCALE = 1.5


def read_glb(path):
    binary = Path(path).read_bytes()
    if binary[:4] != b'glTF' or struct.unpack_from('<I', binary, 4)[0] != 2:
        raise ValueError(f'Invalid glTF 2.0 binary: {path}')
    if struct.unpack_from('<I', binary, 8)[0] != len(binary):
        raise ValueError('Invalid GLB length')
    size = struct.unpack_from('<I', binary, 12)[0]
    if binary[16:20] != b'JSON' or binary[24+size:28+size] != b'BIN\0':
        raise ValueError('Unexpected GLB chunks')
    return json.loads(binary[20:20+size]), bytearray(binary[28+size:]), binary


def accessor(g, data, index):
    item = g['accessors'][index]
    view = g['bufferViews'][item['bufferView']]
    data_type = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[item['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[item['type']]
    offset = view.get('byteOffset', 0)+item.get('byteOffset', 0)
    return np.frombuffer(data, dtype=np.dtype(data_type), count=item['count']*width,
                         offset=offset).reshape(item['count'], width)


def align(src_a, src_b, dst_a, dst_b):
    """Axis-aligned rest-space retarget, preserving round arm cross sections."""
    u = np.asarray(src_b)-src_a
    v = np.asarray(dst_b)-dst_a
    source_length, target_length = np.linalg.norm(u), np.linalg.norm(v)
    u, v = u/source_length, v/target_length
    cross = np.cross(u, v)
    cosine = float(np.clip(u @ v, -1, 1))
    skew = np.array([[0., -cross[2], cross[1]],
                     [cross[2], 0., -cross[0]],
                     [-cross[1], cross[0], 0.]])
    if cosine < -0.99999:
        raise ValueError('Unresolvable antiparallel arm axis')
    rotation = np.eye(3)+skew+skew@skew/(1+cosine)
    axis_scale = target_length/source_length
    stretch = np.eye(3)*.88 + (axis_scale-.88)*np.outer(u, u)
    matrix = rotation @ stretch
    return matrix, np.asarray(dst_a)-matrix@src_a


def source_leg_rest_points(g, blob):
    """Read Victoria's actual deform-joint pivots from GLB inverse bind poses.

    The decoded source mesh and inverse bind matrices share mesh-local space.
    Explicit joints, rather than guessed knee/ankle vertex bands, locate the
    original anatomical hinges even when Victoria's authored pose is bent.
    """
    skin=g['skins'][0]
    inverse=accessor(g,blob,skin['inverseBindMatrices'])
    if inverse.shape[1]!=16:
        raise ValueError('Victoria source inverse bind accessor must be MAT4')
    matrices=inverse.reshape(-1,4,4).transpose(0,2,1).astype(np.float64)
    pivots=np.linalg.inv(matrices)[:,:3,3]*SCALE
    names=[g['nodes'][i]['name'] for i in skin['joints']]
    out={}
    for side in ('L','R'):
        for joint in ('thigh','shin','foot'):
            label=f'DEF-{joint}.{side}'
            matching=[i for i,n in enumerate(names) if n==label]
            if len(matching)!=1:raise ValueError('Missing unique Victoria deform pivot '+label)
            out[(side,joint)]=pivots[matching[0]]
        hip,knee,ankle=(out[(side,key)] for key in ('thigh','shin','foot'))
        if min(np.linalg.norm(knee-hip),np.linalg.norm(ankle-knee))<.1:
            raise ValueError('Degenerate Victoria '+side+' anatomical joint span')
    return out


def retarget_body(points, normals, joints, weights, source_names, target_indices, source_leg_pivots):
    """Repose a fully authored body and reduce its Rigify controls to Tab's 20 joints."""
    point_out = np.zeros_like(points, dtype=np.float64)
    normal_out = np.zeros_like(normals, dtype=np.float64)
    mapped_weights = np.zeros((len(points), len(target_indices)), dtype=np.float64)
    transformations = {}
    for source_side, tab_side in (('L','R'), ('R','L')):
        direction = 1 if source_side == 'L' else -1
        a = SCALE*np.array([direction*.0691, 1.1268, -.019])
        b = SCALE*np.array([direction*.2817, 1.123, -.023])
        c = SCALE*np.array([direction*.4947, 1.1153, -.0112])
        if tab_side == 'R':
            A = np.array([.218, 1.762, .0]); B = np.array([.293, 1.559, .008])
            C = np.array([.347, .973, .109])
        else:
            A = np.array([-.218, 1.762, .0]); B = np.array([-.359, 1.535, .005])
            C = np.array([-.193, 1.295, .135])
        transformations[(source_side,'upper')] = align(a, b, A, B)
        transformations[(source_side,'lower')] = align(b, c, B, C)
        # The forearm may need stretching to reach the authored bear grip,
        # but the palm and fingers must retain their child-size proportions.
        lower_matrix = transformations[(source_side,'lower')][0]
        orientation, _, axes = np.linalg.svd(lower_matrix)
        hand_matrix = .94 * (orientation @ axes)
        transformations[(source_side,'hand')] = (hand_matrix, C-hand_matrix@c)
        # Victoria's leg mesh was formerly just translated. Her authored knee
        # and ankle vertices then followed mismatched Tab pivots: the shoe was
        # on the floor, but the visible lower leg kinked halfway up her calf.
        # Fit BOTH original thigh and shin rest axes to Tab's true bone spans.
        sign = 1 if tab_side=='R' else -1
        hip=np.array([sign*.135,1.190,.0])
        knee=np.array([sign*.14,.663,.023])
        ankle=np.array([sign*.135,.145,.034])
        source_hip=source_leg_pivots[(source_side,'thigh')]
        source_knee=source_leg_pivots[(source_side,'shin')]
        source_ankle=source_leg_pivots[(source_side,'foot')]
        transformations[(source_side,'thigh')] = align(
            source_hip,source_knee,hip,knee)
        transformations[(source_side,'shin')] = align(
            source_knee,source_ankle,knee,ankle)
        # Translate the actual foot pivot to the ankle without stretching toes.
        shin_axis=transformations[(source_side,'shin')][0]
        u,_,vt=np.linalg.svd(shin_axis)
        foot_rotation=u@vt
        transformations[(source_side,'foot')]=(
            foot_rotation,ankle-foot_rotation@source_ankle)
    body = np.diag([.91, 1., .92])
    transformations['body'] = (body, np.zeros(3))

    def classify(name):
        if not name.startswith('DEF-'):
            raise ValueError('Unexpected source weight bone '+name)
        key = name[4:]
        source_side = 'L' if '.L' in key else 'R' if '.R' in key else None
        target_side = {'L':'R','R':'L'}.get(source_side)
        if key.startswith(('upper_arm','shoulder')) and source_side:
            return ('shoulder.'+target_side,(source_side,'upper'))
        if key.startswith(('hand','thumb','palm','f_')) and source_side:
            return ('hand.'+target_side,(source_side,'hand'))
        if key.startswith('forearm') and source_side:
            part = 'wrist.' if '.001' in key else 'elbow.'
            return (part+target_side,(source_side,'lower'))
        if key.startswith(('thigh','pelvis')) and source_side:
            return ('hip.'+target_side,(source_side,'thigh'))
        if key.startswith('shin') and source_side:
            # Both source shin sections deform with the knee; assigning the
            # lower shin to the ankle makes an extra joint halfway up
            # the calf, even though the anatomical ankle bone is low.
            return ('knee.'+target_side,(source_side,'shin'))
        if key.startswith(('foot','toe')) and source_side:
            return ('ankle.'+target_side,(source_side,'foot'))
        if key.startswith('spine'):
            section = int(key.split('.')[-1]) if '.' in key else 0
            target = ('spine' if section<=2 else 'chest' if section<=4 else
                      'neck' if section==5 else 'head')
            return (target,'body')
        return ('head','body')  # Face details stay inside the cardboard mask.

    n = len(points)
    if not (normals.shape==(n,3) and joints.shape==(n,4) and weights.shape==(n,4)):
        raise ValueError('Source vertex attributes not aligned')
    positions = SCALE*np.asarray(points,dtype=np.float64)
    for slot in range(4):
        for source_id in np.unique(joints[:,slot]):
            mask=(joints[:,slot]==source_id) & (weights[:,slot]>0)
            if not np.any(mask):continue
            name=source_names[int(source_id)]
            dest,xf=classify(name)
            mat,translation=transformations[xf]
            w=weights[mask,slot].astype(np.float64)[:,None]
            point_out[mask]+=w*(positions[mask]@mat.T+translation)
            normal_out[mask]+=w*(normals[mask]@np.linalg.inv(mat))
            mapped_weights[mask,target_indices[dest]]+=w[:,0]
    # Victoria's imported fingers were straight and hung below the toy.
    # Curl the RIGHT hand's source finger tips around the left teddy ear.
    # The bone mapping mirrors source .L to Tab hand.R; preserve the palm
    # and interpolate offsets by the original per-vertex finger weights.
    grip_bends={
        'f_index.01':(.008,.026,-.003),
        'f_index.02':(.019,.068,-.011),
        'f_index.03':(.027,.110,-.022),
        'thumb.01':(.010,.012,-.018),
        'thumb.02':(.038,.044,-.046),
        'thumb.03':(.061,.080,-.071),
        'f_middle.02':(0,.035,-.008),
        'f_middle.03':(0,.066,-.012),
        'f_ring.02':(0,.026,.005),
        'f_ring.03':(0,.055,.012),
        'f_pinky.02':(0,.023,.008),
        'f_pinky.03':(0,.046,.015)}
    for segment,offset in grip_bends.items():
        source_joint=source_names.index('DEF-'+segment+'.L')
        influence=np.sum(np.where(joints==source_joint,weights,0),axis=1)
        point_out+=influence[:,None]*np.asarray(offset)

    sums=mapped_weights.sum(axis=1)
    if np.min(sums)<.99 or np.max(sums)>1.01:
        raise ValueError('Source weights were lost while remapping')
    mapped_weights/=sums[:,None]
    chosen=np.argsort(-mapped_weights,axis=1)[:,:4]
    blend=np.take_along_axis(mapped_weights,chosen,axis=1).astype(np.float32)
    blend/=blend.sum(axis=1,keepdims=True)
    point_out/=sums[:,None]
    normal_out/=np.maximum(np.linalg.norm(normal_out,axis=1,keepdims=True),1e-9)
    return (point_out.astype(np.float32), normal_out.astype(np.float32),
            chosen.astype(np.uint16), blend)


def append_view(g, blob, content, target=None):
    blob.extend(b'\0'*(-len(blob)%4))
    offset=len(blob)
    blob.extend(content)
    view={'buffer':0,'byteOffset':offset,'byteLength':len(content)}
    if target is not None:view['target']=target
    g['bufferViews'].append(view)
    return len(g['bufferViews'])-1


def append_accessor(g, blob, array, component_type, shape, target=34962, minmax=False):
    arr=np.ascontiguousarray(array)
    view=append_view(g,blob,arr.tobytes(),target)
    a={'bufferView':view,'componentType':component_type,'count':len(arr),'type':shape}
    if minmax:
        a['min']=np.min(arr,axis=0).astype(float).tolist()
        a['max']=np.max(arr,axis=0).astype(float).tolist()
    g['accessors'].append(a)
    return len(g['accessors'])-1


def patch_legs(g, blob):
    """Move knees/hips to Victoria's unchanged leg proportions, without moving costume."""
    nodes=g['nodes']
    names={n['name']:i for i,n in enumerate(nodes)}
    children={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
    world={}
    def absolute(index):
        if index not in world:
            local=np.asarray(nodes[index].get('translation',[0,0,0]),dtype=np.float64)
            world[index]=local+(absolute(children[index]) if index in children else 0)
        return world[index]
    for index in range(len(nodes)):absolute(index)
    overrides={}
    for s in ('L','R'):
        sign=-1 if s=='L' else 1
        overrides[names['hip.'+s]]=np.array([sign*.135,1.190,.0])
        overrides[names['knee.'+s]]=np.array([sign*.14,.663,.023])
        overrides[names['ankle.'+s]]=np.array([sign*.135,.145,.034])
    new={i:overrides.get(i,world[i]) for i in range(len(nodes))}
    for index in overrides:
        parent=children[index]
        nodes[index]['translation']=(new[index]-new[parent]).tolist()
    gskin=g['skins'][0]
    inv=accessor(g,blob,gskin['inverseBindMatrices'])
    if inv.shape!=(20,16):raise ValueError('Tab must keep its 20 joints')
    for i,index in enumerate(gskin['joints']):
        matrix=np.eye(4,dtype=np.float32)
        matrix[:3,3]=-new[index]
        inv[i,:]=matrix.T.reshape(16)
    return names


def append_image(g, blob, source_g, source_bin, name):
    image=next(i for i in source_g['images'] if i['name']==name)
    view=source_g['bufferViews'][image['bufferView']]
    start=view.get('byteOffset',0)
    data=source_bin[start:start+view['byteLength']]
    with Image.open(io.BytesIO(data)) as original:
        image_data=io.BytesIO()
        original.convert('RGBA').save(image_data,format='PNG',optimize=True)
    index=append_view(g,blob,image_data.getvalue())
    g['images'].append({'bufferView':index,'mimeType':'image/png','name':'Victoria/'+name})
    g['textures'].append({'source':len(g['images'])-1,'sampler':0,'name':'Victoria/'+name})
    return len(g['textures'])-1


def retessellate_sleeves(g, blob):
    """Replace two-ring rod sleeves with rounded, multi-ring skinned cloth.

    Retain all other dress triangles exactly; fit_costume later reshapes the
    new rings and computes their actual smoothed surface normals.
    """
    skin_names=[g['nodes'][i]['name'] for i in g['skins'][0]['joints']]
    joints={name:i for i,name in enumerate(skin_names)}
    part=next(p for p in g['meshes'][0]['primitives']
              if g['materials'][p['material']]['name']=='Tab/Dress_Dark')
    attrs=part['attributes']
    original={name:accessor(g,blob,index).copy() for name,index in attrs.items()}
    primary=original['JOINTS_0'][:,0].reshape(-1,3)
    sleeves=[joints['shoulder.L'],joints['shoulder.R']]
    keep=~np.all(np.isin(primary,sleeves),axis=1)
    chunks={name:[data.reshape(-1,3,data.shape[1])[keep].reshape(-1,data.shape[1])]
            for name,data in original.items()}
    for side,start,end,r0,r1 in (
        ('L',[-.223,1.777,0],[-.366,1.532,0],.109,.090),
        ('R',[.223,1.776,0],[.292,1.571,.005],.098,.074)):
        start=np.array(start,dtype=np.float64)
        end=np.array(end,dtype=np.float64)
        axis=(end-start)/np.linalg.norm(end-start)
        tangent=np.cross(axis,[0,0,1.])
        tangent/=np.linalg.norm(tangent)
        bitangent=np.cross(axis,tangent)
        shoulder=joints['shoulder.'+side]
        chest=joints['chest']
        elbow=joints['elbow.'+side]
        vertices={name:[] for name in attrs}
        def vertex(t,k):
            angle=k*2*np.pi/20
            radial=tangent*np.cos(angle)+bitangent*np.sin(angle)
            radius=(1-t)*r0+t*r1
            location=start+(end-start)*t+radial*radius
            chest_weight=.30*(1-t)**4
            elbow_weight=.28*t**3
            return {
                'POSITION':location.astype(np.float32),
                'NORMAL':radial.astype(np.float32),
                'TEXCOORD_0':np.array([k/20,t],dtype=np.float32),
                'JOINTS_0':np.array([shoulder,chest,elbow,0],dtype=np.uint16),
                'WEIGHTS_0':np.array([1-chest_weight-elbow_weight,
                                      chest_weight,elbow_weight,0],dtype=np.float32)}
        for row in range(7):
            t0=row/7;t1=(row+1)/7
            for segment in range(20):
                ring=[vertex(t0,segment),vertex(t1,segment),
                      vertex(t1,segment+1),vertex(t0,segment+1)]
                for face in ((0,3,2),(0,2,1)):
                    for index in face:
                        for name in attrs:
                            vertices[name].append(ring[index][name])
        for name in attrs:
            chunks[name].append(np.asarray(vertices[name],dtype=original[name].dtype))
    final={name:np.ascontiguousarray(np.concatenate(chunks[name]))
           for name in attrs}
    for name,data in final.items():
        previous=g['accessors'][attrs[name]]
        attrs[name]=append_accessor(g,blob,data,previous['componentType'],
                                    previous['type'],34962,
                                    minmax=name=='POSITION')


def fit_costume(g, blob):
    """Fit original costume mesh to human calves, shoes, and articulated sleeves.

    Preserve original UVs, material IDs, tear topology, and the exposed feet.
    Only the Victoria candidate is changed, not the fallback reference GLB.
    """
    joints={g['nodes'][n]['name']:i for i,n in enumerate(g['skins'][0]['joints'])}
    for part in g['meshes'][0]['primitives']:
        material=g['materials'][part['material']]['name']
        attrs=part['attributes']
        if material not in {'Tab/Dress_Main','Tab/Dress_Dark','Tab/Dress_Light',
                            'Tab/Dress_Shadow','Tab/Dress_Dirt','Tab/Shoe','Tab/Ink'}:
            continue
        pos=accessor(g,blob,attrs['POSITION'])
        ids=accessor(g,blob,attrs['JOINTS_0'])
        if material.startswith('Tab/Dress_'):
            weights=accessor(g,blob,attrs['WEIGHTS_0'])
            # The skirt is still one continuous torn piece. Its lower panels
            # follow both hips, unlike the nearly rigid 14% source weights.
            mask=(ids[:,0]==joints['spine'])&(pos[:,1]<1.31)
            if np.any(mask):
                y=pos[mask,1]
                hip_weight=.38*np.clip((1.31-y)/.78,0,1)
                left=np.clip(.5-pos[mask,0]/1.0,.08,.92)
                ids[mask,1]=joints['hip.L']
                ids[mask,2]=joints['hip.R']
                weights[mask,0]=1-hip_weight
                weights[mask,1]=hip_weight*left
                weights[mask,2]=hip_weight*(1-left)
                weights[mask,3]=0
            if material=='Tab/Dress_Dark':
                # Sculpt the two rod-like sleeves into rounded cloth caps,
                # a shallow elbow taper, cuff flare, and fine folded creases.
                sleeves=[
                    ('L',np.array([-.223,1.777,0.]),np.array([-.366,1.532,0.])),
                    ('R',np.array([.223,1.776,0.]),np.array([.292,1.571,.005]))]
                for side,start,end in sleeves:
                    mask=(ids[:,0]==joints['shoulder.'+side])&(pos[:,1]>1.43)
                    axis=end-start
                    lengths=np.sum(axis*axis)
                    t=np.clip(((pos[mask]-start)@axis)/lengths,0,1)
                    center=start+t[:,None]*axis
                    radial=pos[mask]-center
                    angle=np.arctan2(radial[:,2],radial[:,0])
                    cap=.14*np.sin(np.pi*t)**2
                    cuff=.13*np.clip((t-.82)/.18,0,1)**2
                    wrinkles=.045*np.sin(7*angle+12*t)*np.sin(np.pi*t)**2
                    pos[mask]=center+radial*(1+cap+cuff+wrinkles)[:,None]
                # The bodice has softly tailored fabric panels rather than
                # a single invariant-radius tube along the entire torso.
                mask=(ids[:,0]==joints['chest'])&(pos[:,1]>=1.35)&(pos[:,1]<1.85)
                if np.any(mask):
                    angle=np.arctan2(pos[mask,2],pos[mask,0])
                    drape=1+.028*np.sin(angle*6+pos[mask,1]*9)
                    pos[mask,0]*=drape
                    pos[mask,2]*=drape
        if material in {'Tab/Shoe','Tab/Ink'}:
            mask=np.ones(len(pos),dtype=bool) if material=='Tab/Shoe' else (
                (ids[:,0]==joints['ankle.L']) | (ids[:,0]==joints['ankle.R']))
            if np.any(mask):
                # Keep the existing sole flush to the ground, raising only
                # the upper leather so Victoria's toes sit INSIDE the flats.
                lift=np.clip((pos[mask,1]-.025)/.077,0,1)
                pos[mask,1]+=.058*lift**1.4
        if material in {'Tab/Dress_Dark','Tab/Shoe','Tab/Ink'}:
            # These primitives use unindexed triangle soup. Rebuild normals
            # from the POST-FIT triangles, averaging coincident vertices for
            # smooth cloth and leather while retaining hard ink edges.
            normal=accessor(g,blob,attrs['NORMAL'])
            triangles=pos.reshape(-1,3,3)
            area=np.cross(triangles[:,1]-triangles[:,0],
                          triangles[:,2]-triangles[:,0])
            if material=='Tab/Ink':
                face=area/np.maximum(np.linalg.norm(area,axis=1,keepdims=True),1e-9)
                changed=(ids[:,0]==joints['ankle.L']) | (ids[:,0]==joints['ankle.R'])
                normal[changed]=np.repeat(face,3,axis=0)[changed]
            else:
                _,inverse=np.unique(np.round(pos,6),axis=0,return_inverse=True)
                sums=np.zeros((int(inverse.max())+1,3),dtype=np.float64)
                np.add.at(sums,inverse,np.repeat(area,3,axis=0))
                magnitude=np.linalg.norm(sums,axis=1,keepdims=True)
                smooth=sums/np.maximum(magnitude,1e-9)
                normal[:]=smooth[inverse].astype(np.float32)
            p=g['accessors'][attrs['POSITION']]
            p['min']=np.min(pos,axis=0).astype(float).tolist()
            p['max']=np.max(pos,axis=0).astype(float).tolist()


def main(source, decoded, tab, target):
    src,source_bin,raw=read_glb(source)
    if hashlib.sha256(raw).hexdigest()!=SOURCE_SHA256:
        raise ValueError('Victoria source hash changed; inspect replacement before rebinding')
    g,blob,_=read_glb(tab)
    source_arrays=np.load(decoded)
    p=src['meshes'][0]['primitives'][0]
    if src['meshes'][0]['name']!='body' or len(src['skins'])!=1:
        raise ValueError('Wrong Victoria source mesh')
    if not {'JOINTS_0','WEIGHTS_0','POSITION','TEXCOORD_0','NORMAL','faces'}.issubset(source_arrays.files):
        raise ValueError('Missing Draco-decoded Victoria mesh attributes')
    # Ensure the Draco payload really belongs to the official source version.
    if len(source_arrays['POSITION']) != src['accessors'][p['attributes']['POSITION']]['count']:
        raise ValueError('Unexpected Victoria source body vertex count')
    if source_arrays['POSITION'].shape!=(6438,3) or source_arrays['faces'].shape!=(11252,3):
        raise ValueError('Unexpected Victoria topology')
    # Rotate the teddy around the ear actually held between Victoria's
    # fingers, not around a point below and outside her hand.
    nodes={n['name']:n for n in g['nodes']}
    nodes['bear']['translation']=[.003,-.037,.049]
    patch_legs(g,blob)
    retessellate_sleeves(g,blob)
    fit_costume(g,blob)
    # The GLB joint index is the zero-based slot in the skin.joints list.
    joint_names={n['name']:j for j,n in enumerate([g['nodes'][i] for i in g['skins'][0]['joints']])}
    upstream=[src['nodes'][i]['name'] for i in src['skins'][0]['joints']]
    leg_pivots=source_leg_rest_points(src,source_bin)
    pos,norm,joint,weight=retarget_body(source_arrays['POSITION'],source_arrays['NORMAL'],
                                        source_arrays['JOINTS_0'],source_arrays['WEIGHTS_0'],
                                        upstream,joint_names,leg_pivots)
    uv=source_arrays['TEXCOORD_0'].astype(np.float32)
    faces=source_arrays['faces'].astype(np.uint32)
    # Covered anatomy must not bleed through the owner's intact dress or box.
    # Preserve authored hands, exposed forearms, shins and shoes as geometry;
    # remove only the original child's hidden scalp/torso/upper-thigh faces.
    binding=np.argmax(weight,axis=1)
    dominant=joint[np.arange(len(joint)),binding]
    name_by_joint=[g['nodes'][i]['name'] for i in g['skins'][0]['joints']]
    covered=np.array([name_by_joint[int(j)] in {'spine','chest','neck','head'} or
        (name_by_joint[int(j)] in {'hip.L','hip.R'} and pos[i,1]>.74)
        for i,j in enumerate(dominant)],dtype=bool)
    # Face-level culling avoids splitting UVs or touching original Tab dress.
    faces=faces[~np.any(covered[faces],axis=1)]
    if np.any(faces>=len(pos)) or np.any(uv<0) or np.any(uv>1):
        raise ValueError('Source face index or UV out of bounds')
    attrs={
        'POSITION':append_accessor(g,blob,pos,5126,'VEC3',minmax=True),
        'NORMAL':append_accessor(g,blob,norm,5126,'VEC3'),
        'TEXCOORD_0':append_accessor(g,blob,uv,5126,'VEC2'),
        'JOINTS_0':append_accessor(g,blob,joint,5123,'VEC4'),
        'WEIGHTS_0':append_accessor(g,blob,weight,5126,'VEC4')}
    indices=append_accessor(g,blob,faces.reshape(-1,1),5125,'SCALAR',34963)
    materials=g['materials']
    skin_id=next(i for i,m in enumerate(materials) if m['name']=='Tab/Skin')
    primitives=g['meshes'][0]['primitives']
    originals=[x for x in primitives if x['material']==skin_id]
    if len(originals)!=1:raise ValueError('Expected exactly one old Tab skin primitive')
    primitives.remove(originals[0])
    primitives.append({'attributes':attrs,'indices':indices,'material':skin_id,'mode':4})
    color=append_image(g,blob,src,source_bin,'body_BaseColor')
    normal=append_image(g,blob,src,source_bin,'body_Normal')
    material=materials[skin_id]
    material['pbrMetallicRoughness']['baseColorFactor']=[1,1,1,1]
    material['pbrMetallicRoughness']['baseColorTexture']={'index':color}
    material['normalTexture']={'index':normal,'scale':.85}
    g['asset']['generator']='HahaPewPew Rex Mun Victoria body + reference-bound Tab costume'
    g['asset'].setdefault('extras',{})['sourceModel']={
        'name':'Victoria Character Rigged','creator':'Rex Mun','license':'royalty_free',
        'assetBaseId':ASSET_ID,'sourceSHA256':SOURCE_SHA256,
        'textureAndShapePreservation':'original printed box and teddy geometry, UVs, skirt tear topology retained; skirt weights, tailored sleeves, covered shoe uppers and ear pivot fitted to Victoria'}
    g['meshes'][0]['name']='Tab: Victoria body / original torn dress, box and bear'
    blob.extend(b'\0'*(-len(blob)%4))
    g['buffers'][0]['byteLength']=len(blob)
    text=json.dumps(g,separators=(',',':')).encode('utf8')
    text+=b' '*(-len(text)%4)
    result=(struct.pack('<4sII',b'glTF',2,12+8+len(text)+8+len(blob))+
            struct.pack('<I4s',len(text),b'JSON')+text+
            struct.pack('<I4s',len(blob),b'BIN\0')+bytes(blob))
    target=Path(target);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(result)
    print(f'Victoria assembled: {target}, {len(result)} bytes; {len(pos)} body vertices; 20 joints, {len(primitives)} costume/body materials')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',required=True)
    parser.add_argument('--decoded',required=True)
    parser.add_argument('--tab',required=True)
    parser.add_argument('--out',required=True)
    args=parser.parse_args()
    main(args.source,args.decoded,args.tab,args.out)