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


def retarget_body(points, normals, joints, weights, source_names, target_indices):
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
        transformations[(source_side,'leg')] = (np.eye(3), np.array([direction*.030,0,.012]))
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
            return ('hip.'+target_side,(source_side,'leg'))
        if key.startswith('shin') and source_side:
            return (('ankle.' if '.001' in key else 'knee.')+target_side,(source_side,'leg'))
        if key.startswith(('foot','toe')) and source_side:
            return ('ankle.'+target_side,(source_side,'leg'))
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
    patch_legs(g,blob)
    # The GLB joint index is the zero-based slot in the skin.joints list.
    joint_names={n['name']:j for j,n in enumerate([g['nodes'][i] for i in g['skins'][0]['joints']])}
    upstream=[src['nodes'][i]['name'] for i in src['skins'][0]['joints']]
    pos,norm,joint,weight=retarget_body(source_arrays['POSITION'],source_arrays['NORMAL'],
                                        source_arrays['JOINTS_0'],source_arrays['WEIGHTS_0'],
                                        upstream,joint_names)
    uv=source_arrays['TEXCOORD_0'].astype(np.float32)
    faces=source_arrays['faces'].astype(np.uint32)
    # Covered anatomy must not bleed through the owner's intact dress or box.
    # Preserve authored hands, exposed forearms, shins and shoes as geometry;
    # remove only the original child's hidden scalp/torso/upper-thigh faces.
    binding=np.argmax(weight,axis=1)
    dominant=joint[np.arange(len(joint)),binding]
    name_by_joint=[g['nodes'][i]['name'] for i in g['skins'][0]['joints']]
    covered=np.array([name_by_joint[int(j)] in {'spine','chest','neck','head'} or
        (name_by_joint[int(j)] in {'hip.L','hip.R'} and pos[i,1]>1.12)
        for i,j in enumerate(dominant)],dtype=bool)
    # Face-level culling avoids splitting UVs or touching original Tab dress.
    faces=faces[~np.all(covered[faces],axis=1)]
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
        'textureAndShapePreservation':'original Tab dress/cardboard/teddy/shoe geometry unchanged'}
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