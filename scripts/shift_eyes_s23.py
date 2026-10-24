#!/usr/bin/env python3
"""S2.3: position Shift's immobile ink-framed eye decals from the original art.

Input: workbench/shift/Shift_S22.glb. Output is an isolated candidate;
never overwrite the public game GLB or add independent eye controls.
"""
import argparse
import json
import math
import struct
from pathlib import Path

# Approximate bounding boxes established by the S2.1 original-art trace.
ART = {
    'head': (4, 2, 370, 224),
    'left': (105, 137, 95, 62),
    'right': (245, 134, 98, 63),
}
SECTIONS = {
    'Shift/Ink_Outline': {'left': (288, 1152), 'right': (1152, 2016)},
    'Shift/Eyes_2D_Emission': {'left': (0, 864), 'right': (864, 1728)},
}
OFFSET = {'Shift/Ink_Outline': .022, 'Shift/Eyes_2D_Emission': .032}


def build(source: Path, dest: Path):
    raw = source.read_bytes()
    if raw[:4] != b'glTF' or struct.unpack_from('<II', raw, 4) != (2, len(raw)):
        raise ValueError('Expected a complete glTF 2.0 GLB')
    json_length = struct.unpack_from('<I', raw, 12)[0]
    if raw[16:20] != b'JSON':
        raise ValueError('Missing GLB JSON chunk')
    meta = json.loads(raw[20:20 + json_length])
    pos = 20 + json_length
    length, kind = struct.unpack_from('<I4s', raw, pos)
    if kind != b'BIN\0' or pos + 8 + length != len(raw):
        raise ValueError('Unexpected GLB binary chunks')
    data = bytearray(raw[pos+8:])
    if 'shiftDomeS22' not in meta['asset'].get('extras', {}):
        raise ValueError('S2.2 dome candidate required')
    head_index = next(i for i, node in enumerate(meta['nodes']) if node['name'] == 'head')
    head_joint = meta['skins'][0]['joints'].index(head_index)
    if head_joint != 3 or len(meta['skins'][0]['joints']) != 16:
        raise ValueError('Unexpected Shift rig topology')

    def section(name):
        p = next(p for p in meta['meshes'][0]['primitives']
                 if meta['materials'][p['material']]['name'] == name)
        return p

    def accessor(p, key, component, typ):
        item = meta['accessors'][p['attributes'][key]]
        view = meta['bufferViews'][item['bufferView']]
        if item['componentType'] != component or item['type'] != typ or view.get('byteStride'):
            raise ValueError('Unexpected vertex encoding')
        stride = 12 if typ == 'VEC3' else 8
        start = view.get('byteOffset', 0) + item.get('byteOffset', 0)
        if start + stride*item['count'] > len(data):
            raise ValueError('Invalid accessor range')
        return item, start

    shell, shell_offset = accessor(section('Shift/Dome_Side'), 'POSITION', 5126, 'VEC3')
    rings = {}
    for i in range(shell['count']):
        x, y, z = struct.unpack_from('<fff', data, shell_offset + 12*i)
        key = round(y, 5)
        old = rings.get(key, (y, 0.0, 0.0))
        rings[key] = (y, max(old[1], abs(x)), max(old[2], abs(z)))
    rings = sorted(rings.values())
    if len(rings) != 11:
        raise ValueError('Expected the eleven-ring S2.2 shell')
    lo_y, hi_y = rings[0][0], rings[-1][0]
    lo_x, hi_x = shell['min'][0], shell['max'][0]
    head_width, head_height = hi_x-lo_x, hi_y-lo_y

    def surface_depth(x, y):
        if not lo_y-1.e-5 <= y <= hi_y+1.e-5:
            raise ValueError('Decal is outside dome height')
        pair = next(((a, b) for a, b in zip(rings, rings[1:]) if y <= b[0]), None)
        if pair is None:
            pair = rings[-2], rings[-1]
        a, b = pair
        t = max(0., min(1., (y-a[0])/(b[0]-a[0])))
        rx = a[1]+(b[1]-a[1])*t
        rz = a[2]+(b[2]-a[2])*t
        if abs(x) > rx+1.e-6:
            raise ValueError('Decal extends beyond curved dome')
        return rz * math.sqrt(max(0., 1.-(x/rx)**2))

    hx, hy, hw, hh = ART['head']
    def image_x(x):
        return lo_x + (x-hx)*head_width/hw
    def image_y(y):
        return hi_y - (y-hy)*head_height/hh

    target = {}
    for side in ('left', 'right'):
        x, y, w, h = ART[side]
        target[side] = (image_x(x), image_y(y+h), image_x(x+w), image_y(y))

    black = section('Shift/Ink_Outline')
    black_pos, black_offset = accessor(black, 'POSITION', 5126, 'VEC3')
    if black_pos['count'] != 2088:
        raise ValueError('Unknown outline mesh partition')

    def bounds(at, first, stop):
        points = [struct.unpack_from('<fff', data, at+12*i) for i in range(first, stop)]
        return (min(p[0] for p in points), min(p[1] for p in points),
                max(p[0] for p in points), max(p[1] for p in points))

    original = {side: bounds(black_offset, *SECTIONS['Shift/Ink_Outline'][side])
                for side in ('left', 'right')}
    changes = 0
    for name, ranges in SECTIONS.items():
        p = section(name)
        position, p_offset = accessor(p, 'POSITION', 5126, 'VEC3')
        normal, n_offset = accessor(p, 'NORMAL', 5126, 'VEC3')
        joints, j_offset = accessor(p, 'JOINTS_0', 5123, 'VEC4')
        if position['count'] != normal['count'] or position['count'] != joints['count']:
            raise ValueError('Inconsistent mesh arrays')
        for side, (first, stop) in ranges.items():
            if (stop-first) != 864 or first % 3 or stop % 3:
                raise ValueError('Unsupported eye triangulation')
            ox0, oy0, ox1, oy1 = original[side]
            x0, y0, x1, y1 = target[side]
            xscale, yscale = (x1-x0)/(ox1-ox0), (y1-y0)/(oy1-oy0)
            for i in range(first, stop):
                if struct.unpack_from('<H', data, j_offset + 8*i)[0] != head_joint:
                    raise ValueError('Eye decal lost its fixed head attachment')
                x, y, _ = struct.unpack_from('<fff', data, p_offset+12*i)
                xx, yy = x0 + (x-ox0)*xscale, y0 + (y-oy0)*yscale
                zz = surface_depth(xx, yy) + OFFSET[name]
                struct.pack_into('<fff', data, p_offset+12*i, xx, yy, zz)
                changes += 1
            for i in range(first, stop, 3):
                a, b, c = [struct.unpack_from('<fff', data, p_offset+12*(i+j))
                           for j in range(3)]
                u = [b[k]-a[k] for k in range(3)]
                v = [c[k]-a[k] for k in range(3)]
                normal_xyz = (u[1]*v[2]-u[2]*v[1],
                              u[2]*v[0]-u[0]*v[2],
                              u[0]*v[1]-u[1]*v[0])
                magnitude = math.sqrt(sum(x*x for x in normal_xyz))
                if magnitude < 1.e-8:
                    raise ValueError('Degenerate decal triangle')
                for j in range(3):
                    struct.pack_into('<fff', data, n_offset+12*(i+j),
                                     *(x/magnitude for x in normal_xyz))
        coords = [struct.unpack_from('<fff', data, p_offset+12*i)
                  for i in range(position['count'])]
        position['min'] = [min(p[k] for p in coords) for k in range(3)]
        position['max'] = [max(p[k] for p in coords) for k in range(3)]

    if changes != 3456:
        raise ValueError('Unexpected number of modified decal vertices')
    eye, eye_offset = accessor(section('Shift/Eyes_2D_Emission'), 'POSITION', 5126, 'VEC3')
    for side in ('left', 'right'):
        black_box = bounds(black_offset, *SECTIONS['Shift/Ink_Outline'][side])
        white_box = bounds(eye_offset, *SECTIONS['Shift/Eyes_2D_Emission'][side])
        if not (white_box[0] > black_box[0]+.02 and white_box[2] < black_box[2]-.02
                and white_box[1] > black_box[1]+.02 and white_box[3] < black_box[3]-.02):
            raise ValueError('White interior obscures the black eye border')
    meta['asset'].setdefault('extras', {})['shiftEyesS23'] = {
        'step': 'S2.3', 'status': 'candidate only; real browser QA pending',
        'source': 'workbench/shift/Shift_S22.glb',
        'authority': 'public/assets/art/shift.webp',
        'reference': 'docs/characters/shift-fidelity.md',
        'artRect': {name: list(box) for name, box in ART.items()},
        'modelRect': {name: dict(zip(('xmin', 'ymin', 'xmax', 'ymax'), box))
                      for name, box in target.items()},
        'modifiedVertices': changes, 'attachments': 'head skin joint only',
        'inkDepth': OFFSET['Shift/Ink_Outline'],
        'whiteDepth': OFFSET['Shift/Eyes_2D_Emission'],
    }
    payload = json.dumps(meta, separators=(',', ':'), ensure_ascii=True).encode('ascii')
    payload += b' ' * (-len(payload) % 4)
    binary = (struct.pack('<4sII', b'glTF', 2, 12+8+len(payload)+8+len(data))
              + struct.pack('<I4s', len(payload), b'JSON') + payload
              + struct.pack('<I4s', len(data), b'BIN\0') + data)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(binary)
    return changes


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    print('S2.3 eye vertices:', build(args.source, args.destination))
