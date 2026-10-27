#!/usr/bin/env python3
"""S2.2: reshape the candidate Shift dome; do not replace the shipped model.

The GLB's original armature, animations, eye linkage, torso and limb geometry
are preserved. Only head-bound vertices and their face normals are modified.
Source: workbench/shift/Shift_Rigged_PreS28.glb (immutable historical fixture)
Output: workbench/shift/Shift_S22.glb
"""
import argparse
import json
import math
import struct
from pathlib import Path

# Approximate source-art crop bounds in docs/characters/shift-fidelity.md.
# Match both the full width/height and the curve; ratios alone produced a
# pointed helmet in the first S2.2 candidate. Do not infer the unknown depth.
DRAWN_HEAD_WIDTH = 370
DRAWN_HEAD_HEIGHT = 224
DRAWN_TORSO_WIDTH = 121
HEAD_MATERIALS = frozenset({
    'Shift/Dome_Graphite', 'Shift/Dome_Side',
    'Shift/Ink_Outline', 'Shift/Eyes_2D_Emission',
})
EXPECTED = {
    'Shift/Dome_Graphite': 2160,
    'Shift/Dome_Side': 3600,
    'Shift/Ink_Outline': 2016,
    'Shift/Eyes_2D_Emission': 1728,
}


def build(source: Path, dest: Path) -> dict:
    data = source.read_bytes()
    if data[:4] != b'glTF' or struct.unpack_from('<II', data, 4) != (2, len(data)):
        raise ValueError('Expected complete glTF 2.0 GLB')
    length = struct.unpack_from('<I', data, 12)[0]
    if data[16:20] != b'JSON':
        raise ValueError('Expected JSON first GLB chunk')
    meta = json.loads(data[20:20 + length])
    start = 20 + length
    size, kind = struct.unpack_from('<I4s', data, start)
    if kind != b'BIN\0' or start + 8 + size != len(data):
        raise ValueError('Expected one complete binary chunk')
    blob = bytearray(data[start + 8:])
    head_node = next(i for i, node in enumerate(meta['nodes']) if node['name'] == 'head')
    head_joint = meta['skins'][0]['joints'].index(head_node)
    if head_joint != 3 or len(meta['skins'][0]['joints']) != 16:
        raise ValueError('Unexpected Shift joint layout')

    def access(index, component, type_name):
        a = meta['accessors'][index]
        v = meta['bufferViews'][a['bufferView']]
        if a['componentType'] != component or a['type'] != type_name or v.get('byteStride'):
            raise ValueError('Unsupported Shift vertex format')
        stride = 12 if type_name == 'VEC3' else 8
        offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        if offset + a['count'] * stride > len(blob):
            raise ValueError('Attribute outside GLB buffer')
        return a, offset

    # Sample the actual source asset's dome rings. The older authoring script
    # is not necessarily identical to the hand-adjusted exported GLB.
    def primitive(name):
        return next(p for p in meta['meshes'][0]['primitives']
                    if meta['materials'][p['material']]['name'] == name)

    dome = primitive('Shift/Dome_Side')
    dp, do = access(dome['attributes']['POSITION'], 5126, 'VEC3')
    rings_by_y = {}
    for i in range(dp['count']):
        x, y, _ = struct.unpack_from('<fff', blob, do + 12*i)
        key = round(y, 5)
        rings_by_y[key] = (y, max(abs(x), rings_by_y.get(key, (y, 0))[1]))
    rings = sorted(rings_by_y.values())
    if len(rings) != 11:
        raise ValueError(f'Unexpected dome topology: {len(rings)} rings')
    base_y, top_y = rings[0][0], rings[-1][0]
    if top_y <= base_y:
        raise ValueError('Invalid dome elevation')

    ink = primitive('Shift/Ink_Outline')
    ip, io = access(ink['attributes']['POSITION'], 5126, 'VEC3')
    ij, jo_ink = access(ink['attributes']['JOINTS_0'], 5123, 'VEC4')
    torso_x = [struct.unpack_from('<f', blob, io+12*i)[0]
               for i in range(ip['count'])
               if struct.unpack_from('<H', blob, jo_ink+8*i)[0] != head_joint]
    if not torso_x:
        raise ValueError('Missing independent torso ink silhouette')
    torso_width = max(torso_x) - min(torso_x)
    target_width = torso_width * DRAWN_HEAD_WIDTH / DRAWN_TORSO_WIDTH
    target_height = torso_width * DRAWN_HEAD_HEIGHT / DRAWN_TORSO_WIDTH
    half_width = target_width/2
    scale_y = target_height/(top_y-base_y)

    def original_radius(y):
        if y <= base_y:
            return rings[0][1]
        if y >= top_y:
            return rings[-1][1]
        for (lo, r_lo), (hi, r_hi) in zip(rings, rings[1:]):
            if y <= hi:
                return r_lo + (r_hi-r_lo)*(y-lo)/(hi-lo)
        raise ValueError('Unreachable radius interpolation')

    counts = {}
    for prim in meta['meshes'][0]['primitives']:
        name = meta['materials'][prim['material']]['name']
        attrs = prim['attributes']
        pos, po = access(attrs['POSITION'], 5126, 'VEC3')
        norm, no = access(attrs['NORMAL'], 5126, 'VEC3')
        joints, jo = access(attrs['JOINTS_0'], 5123, 'VEC4')
        if pos['count'] != norm['count'] or pos['count'] != joints['count']:
            raise ValueError('Vertex attributes have different lengths')
        changed = 0
        for i in range(pos['count']):
            if struct.unpack_from('<H', blob, jo + 8 * i)[0] != head_joint:
                continue
            if name not in HEAD_MATERIALS:
                raise ValueError('Unexpected head geometry in material ' + name)
            x, y, z = struct.unpack_from('<fff', blob, po + 12 * i)
            t = min(1.0, max(0.0, (y-base_y)/(top_y-base_y)))
            new_radius = max(.002, half_width * math.sqrt(max(0.0, 1-t*t)))
            struct.pack_into('<fff', blob, po + 12*i,
                             x * new_radius / original_radius(y),
                             base_y + (y-base_y) * scale_y, z)
            changed += 1
        if changed:
            # The x-scaling now varies with height, so transform-space
            # rescaling of old face normals is wrong. These are non-indexed
            # flat triangles: recompute each cross-product after deformation.
            if pos['count'] % 3:
                raise ValueError('Expected triangle-aligned head vertices')
            for i in range(0, pos['count'], 3):
                is_head = [struct.unpack_from('<H', blob, jo+8*(i+j))[0] == head_joint
                           for j in range(3)]
                if not any(is_head):
                    continue
                if not all(is_head):
                    raise ValueError('Mixed head/body attachment in triangle')
                a, b, c = [struct.unpack_from('<fff', blob, po+12*(i+j))
                           for j in range(3)]
                ab = [b[k]-a[k] for k in range(3)]
                ac = [c[k]-a[k] for k in range(3)]
                normal = (ab[1]*ac[2]-ab[2]*ac[1],
                          ab[2]*ac[0]-ab[0]*ac[2],
                          ab[0]*ac[1]-ab[1]*ac[0])
                magnitude = math.sqrt(sum(v*v for v in normal))
                if magnitude < 1e-8:
                    raise ValueError(f'Degenerate dome triangle at {i}')
                unit = [v/magnitude for v in normal]
                for j in range(3):
                    struct.pack_into('<fff', blob, no+12*(i+j), *unit)
            coords = [struct.unpack_from('<fff', blob, po + 12 * i)
                      for i in range(pos['count'])]
            pos['min'] = [min(v[k] for v in coords) for k in range(3)]
            pos['max'] = [max(v[k] for v in coords) for k in range(3)]
            counts[name] = changed
    if counts != EXPECTED:
        raise ValueError(f'Head mesh changed unexpectedly: {counts!r}')
    meta['asset'].setdefault('extras', {})['shiftDomeS22'] = {
        'step': 'S2.2',
        'status': 'candidate; orthographic browser acceptance pending',
        'source': 'workbench/shift/Shift_Rigged_PreS28.glb',
        'reference': 'docs/characters/shift-fidelity.md',
        'profile': 'elliptic domed shell; radius=halfWidth*sqrt(1-heightFraction^2)',
        'targetW': target_width, 'targetH': target_height,
        'baseY': base_y, 'sy': scale_y,
        'originalRings': [{'y': y, 'rx': x} for y, x in rings],
        'modifiedVertices': sum(counts.values()),
        'preserved': ['joint hierarchy', 'animations', 'UVs', 'skin weights',
                      'all torso/limb vertices', 'front decal attachment', 'depth values'],
    }
    packed = json.dumps(meta, separators=(',', ':'), ensure_ascii=True).encode('ascii')
    packed += b' ' * (-len(packed) % 4)
    header = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(packed) + 8 + len(blob))
    candidate = (header + struct.pack('<I4s', len(packed), b'JSON') + packed
                 + struct.pack('<I4s', len(blob), b'BIN\0') + blob)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(candidate)
    return counts


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('dest', type=Path)
    args = parser.parse_args()
    print('S2.2 candidate:', build(args.source, args.dest))
