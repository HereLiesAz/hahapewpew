#!/usr/bin/env python3
"""S2.4: restage compact Shift torso/arms/legs/feet without replacing live GLB.

Reads the approved-as-candidate S2.3, writes an S2.4 workbench candidate.
The art is the authority; 16 joints and old clips remain intact.
"""
import argparse
import json
import math
import struct
from pathlib import Path

# S2.1 reference: dome y=2..226, torso y=237..348,
# hands descend to y=329, legs/feet to y=390.
ART_HEAD_TOP = 2
ART_HEAD_HEIGHT = 224
ART_TORSO_BOTTOM = 348
ART_ARM_TOP = 239
ART_ARM_BOTTOM = 329
ART_LEG_TOP = 342
ART_FOOT_BOTTOM = 390
BOUND_SOURCE = {
    'body': (.374, .896),
    'arms': (.5065887570381165, .7935943007469177),
    'legs': (.12399999797344208, .39516109228134155),
}
ARM_JOINTS = frozenset((4, 5, 6, 7, 8, 9))
LEG_JOINTS = frozenset((10, 11, 12, 13, 14, 15))
HEAD_JOINTS = frozenset((2, 3))
EXPECTED = {'body': 144, 'arms': 936, 'legs': 504, 'untouched': 9660}


def build(source: Path, dest: Path):
    payload = source.read_bytes()
    if payload[:4] != b'glTF' or struct.unpack_from('<II', payload, 4) != (2, len(payload)):
        raise ValueError('Incomplete glTF 2.0 GLB')
    json_bytes = struct.unpack_from('<I', payload, 12)[0]
    if payload[16:20] != b'JSON':
        raise ValueError('Missing JSON chunk')
    meta = json.loads(payload[20:20 + json_bytes])
    offset = json_bytes + 20
    size, kind = struct.unpack_from('<I4s', payload, offset)
    if kind != b'BIN\0' or offset+8+size != len(payload):
        raise ValueError('Unexpected GLB binary chunk')
    data = bytearray(payload[offset+8:])
    if 'shiftEyesS23' not in meta['asset'].get('extras', {}):
        raise ValueError('Input must be Shift S2.3')
    skin = meta['skins'][0]
    nodes = meta['nodes']
    indices = skin['joints']
    if len(indices) != 16:
        raise ValueError('Unexpected Shift skeleton')
    expected_names = ('root', 'spine', 'neck', 'head', 'arm.L', 'elbow.L',
                      'wrist.L', 'arm.R', 'elbow.R', 'wrist.R', 'hip.L',
                      'knee.L', 'ankle.L', 'hip.R', 'knee.R', 'ankle.R')
    if tuple(nodes[n]['name'] for n in indices) != expected_names:
        raise ValueError('Unexpected Shift bone names')

    def access(index, typ, component):
        a = meta['accessors'][index]
        view = meta['bufferViews'][a['bufferView']]
        if a['type'] != typ or a['componentType'] != component or view.get('byteStride'):
            raise ValueError('Unsupported Shift data format')
        start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = {'VEC3': 12, 'VEC4': 8, 'MAT4': 64}[typ]
        if start+stride*a['count'] > len(data):
            raise ValueError('Broken accessor buffer')
        return a, start

    dome = next(p for p in meta['meshes'][0]['primitives']
                if meta['materials'][p['material']]['name'] == 'Shift/Dome_Side')
    head, _ = access(dome['attributes']['POSITION'], 'VEC3', 5126)
    head_top = head['max'][1]
    head_height = head_top-head['min'][1]

    def art_y(y):
        return head_top-(y-ART_HEAD_TOP)*head_height/ART_HEAD_HEIGHT

    bounds = {
        'body': {'srcMax': BOUND_SOURCE['body'][1],
                 'srcMin': BOUND_SOURCE['body'][0],
                 'dstMax': .896, 'dstMin': art_y(ART_TORSO_BOTTOM)},
        'arms': {'srcMax': BOUND_SOURCE['arms'][1],
                 'srcMin': BOUND_SOURCE['arms'][0],
                 'dstMax': art_y(ART_ARM_TOP), 'dstMin': art_y(ART_ARM_BOTTOM)},
        'legs': {'srcMax': BOUND_SOURCE['legs'][1],
                 'srcMin': BOUND_SOURCE['legs'][0],
                 'dstMax': art_y(ART_LEG_TOP), 'dstMin': art_y(ART_FOOT_BOTTOM)},
    }
    for box in bounds.values():
        box['scale'] = ((box['dstMax']-box['dstMin']) /
                        (box['srcMax']-box['srcMin']))

    def mapped(y, box):
        return box['dstMin']+(y-box['srcMin'])*box['scale']

    def category(j):
        if j == 1:
            return 'body'
        if j in ARM_JOINTS:
            return 'arms'
        if j in LEG_JOINTS:
            return 'legs'
        return 'untouched'

    counts = {key: 0 for key in EXPECTED}
    for primitive in meta['meshes'][0]['primitives']:
        name = meta['materials'][primitive['material']]['name']
        attrs = primitive['attributes']
        p, po = access(attrs['POSITION'], 'VEC3', 5126)
        n, no = access(attrs['NORMAL'], 'VEC3', 5126)
        j, jo = access(attrs['JOINTS_0'], 'VEC4', 5123)
        if p['count'] != n['count'] or p['count'] != j['count'] or p['count'] % 3:
            raise ValueError('Unexpected triangulated mesh layout')
        for i in range(p['count']):
            bone = struct.unpack_from('<H', data, jo+8*i)[0]
            group = category(bone)
            if group == 'body' and name not in ('Shift/Ink_Outline',
                                                'Shift/Body_Graphite',
                                                'Shift/Control_Light'):
                raise ValueError('Unexpected torso material')
            if group in ('arms', 'legs') and name != 'Shift/Limb_Black':
                raise ValueError('Unexpected limb material')
            if group != 'untouched':
                old = struct.unpack_from('<f', data, po+12*i+4)[0]
                struct.pack_into('<f', data, po+12*i+4, mapped(old, bounds[group]))
            counts[group] += 1

        # Vertices are non-indexed, flat-shaded triangles. Moving vertices
        # requires recomputing normals, while all head/eye triangles stay intact.
        for i in range(0, p['count'], 3):
            groups = {category(struct.unpack_from('<H', data, jo+8*(i+k))[0])
                      for k in range(3)}
            if len(groups) != 1:
                raise ValueError('Mixed-category primitive triangle')
            if groups == {'untouched'}:
                continue
            a, b, c = [struct.unpack_from('<fff', data, po+12*(i+k))
                       for k in range(3)]
            u = [b[k]-a[k] for k in range(3)]
            v = [c[k]-a[k] for k in range(3)]
            cross = (u[1]*v[2]-u[2]*v[1],
                     u[2]*v[0]-u[0]*v[2],
                     u[0]*v[1]-u[1]*v[0])
            length = math.sqrt(sum(x*x for x in cross))
            if not math.isfinite(length) or length < 1e-8:
                raise ValueError('Degenerate lower-body triangle')
            for k in range(3):
                struct.pack_into('<fff', data, no+12*(i+k),
                                 *(value/length for value in cross))
        coords = [struct.unpack_from('<fff', data, po+12*i)
                  for i in range(p['count'])]
        p['min'] = [min(row[k] for row in coords) for k in range(3)]
        p['max'] = [max(row[k] for row in coords) for k in range(3)]

    if counts != EXPECTED:
        raise ValueError(f'Unexpected vertex counts {counts!r}')
    # Update rest pivots and inverse binds together. The old walk animation
    # still drives the exact same joint indices.
    parents = {child: index for index, node in enumerate(nodes)
               for child in node.get('children', [])}
    cache = {}

    def world_rest(i):
        if i not in cache:
            y = nodes[i].get('translation', (0, 0, 0))[1]
            cache[i] = y + (world_rest(parents[i]) if i in parents else 0)
        return cache[i]

    old_rest = [world_rest(node) for node in indices]
    new_rest = [mapped(y, bounds[category(j)])
                if category(j) != 'untouched' else y
                for j, y in enumerate(old_rest)]
    absolute = dict(zip(indices, new_rest))
    for i, node in enumerate(indices):
        parent = parents.get(node)
        translation = list(nodes[node]['translation'])
        translation[1] = absolute[node]-absolute.get(parent, 0)
        nodes[node]['translation'] = translation

    inverse, start = access(skin['inverseBindMatrices'], 'MAT4', 5126)
    if inverse['count'] != 16:
        raise ValueError('Unexpected inverse bind matrix count')
    for j, new in enumerate(new_rest):
        struct.pack_into('<f', data, start+j*64+13*4, -new)

    # A shared scene root translates mesh and rig together so the two foot
    # wedges touch the floor, rather than floating as in the earlier asset.
    ground_offset = bounds['legs']['dstMin']
    stage = len(nodes)
    original_roots = list(meta['scenes'][meta.get('scene', 0)]['nodes'])
    nodes.append({'name': 'Shift.S24.GroundAlign',
                  'translation': [0, -ground_offset, 0],
                  'children': original_roots})
    meta['scenes'][meta.get('scene', 0)]['nodes'] = [stage]

    head_fraction = head_height/(head_top-ground_offset)
    torso_height = bounds['body']['dstMax']-bounds['body']['dstMin']
    if abs(head_fraction-224/388) > .003 or abs(head_height/torso_height-224/111) > .1:
        raise ValueError('Model proportions drifted from traced reference')
    meta['asset'].setdefault('extras', {})['shiftLowerS24'] = {
        'step': 'S2.4',
        'status': 'candidate; browser QA, tests and cold review pending',
        'source': 'workbench/shift/Shift_S23.glb',
        'sourceArt': 'public/assets/art/shift.webp',
        'mapBounds': bounds,
        'worldFloorShift': -ground_offset,
        'modifiedVertexCounts': counts,
        'preserved': ['head dome and eyes', '16 existing joints and clips',
                      'mesh UVs and skin weights',
                      'original clamp and foot wedge outlines'],
        'expected': {'headFraction': 224/388, 'headTorsoHeightRatio': 224/111},
        'rigRest': [{'name': name, 'from': old, 'to': new}
                    for name, old, new in zip(expected_names, old_rest, new_rest)],
    }
    packed = json.dumps(meta, separators=(',', ':'), ensure_ascii=True).encode('ascii')
    packed += b' ' * (-len(packed) % 4)
    out = (struct.pack('<4sII', b'glTF', 2, 12+8+len(packed)+8+len(data))
           + struct.pack('<I4s', len(packed), b'JSON')+packed
           + struct.pack('<I4s', len(data), b'BIN\0') + data)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(out)
    return counts


if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('source', type=Path)
    cli.add_argument('dest', type=Path)
    args = cli.parse_args()
    print(build(args.source, args.dest))
