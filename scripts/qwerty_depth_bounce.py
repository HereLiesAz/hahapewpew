#!/usr/bin/env python3
"""Q1.3 correction: deepen the entire trapezoidal upper housing and bounce it
vertically above the fixed bottom surface (NOT a hinged jaw).
Usage: python3 scripts/qwerty_depth_bounce.py workbench/qwerty/Qwerty_Q13.glb workbench/qwerty/Qwerty_Q13_depth_bounce.glb
"""
import argparse
import json
import struct
from pathlib import Path

import numpy as np

from qwerty_head_hinge import unpack, arr

# Owner's two additional references show a substantial SIDE plane, not a thin box.
BACK_DELTA = -.95
BOUNCE = (0., .56, .05, .64, .14, 0.)

def build(src, dst):
    m, data = unpack(src)
    assert m['nodes'][4]['name'] == 'base_plate'
    assert m['nodes'][5]['name'] == 'skull_upper'
    assert len(m['skins'][0]['joints']) == 19
    joints = m['skins'][0]['joints']
    plate, head = joints.index(4), joints.index(5)
    changed = {'housing': 0, 'plate': 0}

    # Expand only the BACK of both the shell and its stationary bottom surface.
    # The face, eye outlines, white eye planes, lids, arms and feet are unmodified.
    for prim in m['meshes'][0]['primitives']:
        a = m['accessors'][prim['attributes']['POSITION']]
        positions = arr(m, data, prim['attributes']['POSITION'])
        skin = arr(m, data, prim['attributes']['JOINTS_0'])
        for vertex, weights in zip(positions, skin):
            bone = int(weights[0])
            if bone == head and vertex[2] < -.288:
                vertex[2] += BACK_DELTA
                changed['housing'] += 1
            elif bone == plate and vertex[2] < -.298:
                vertex[2] += BACK_DELTA
                changed['plate'] += 1
        if 'min' in a:
            a['min'] = positions.min(axis=0).astype(float).tolist()
        if 'max' in a:
            a['max'] = positions.max(axis=0).astype(float).tolist()
    assert changed['housing'] >= 6 and changed['plate'] >= 6, changed

    # Cancel the idle rocking which incorrectly opens a wedge-shaped seam.
    idle = next(anim for anim in m['animations'] if anim['name'] == 'Qwerty_Idle')
    for channel in idle['channels']:
        if channel['target'] == {'node': 5, 'path': 'rotation'}:
            sample = idle['samplers'][channel['sampler']]
            arr(m, data, sample['output'])[:] = [0., 0., 0., 1.]

    # Replace skull rotation with straight vertical translation at the same
    # original sample times. Descendant 2D eyes and eyelids follow the shell.
    talk = next(anim for anim in m['animations'] if anim['name'] == 'Qwerty_Talk_Flap')
    channel = next(ch for ch in talk['channels'] if ch['target'] == {'node': 5, 'path': 'rotation'})
    sampler = talk['samplers'][channel['sampler']]
    assert len(arr(m, data, sampler['input'])) == len(BOUNCE)
    poses = np.asarray([(0., .055 + delta, -.26) for delta in BOUNCE], dtype=np.float32)
    data = bytearray(data)  # drop live NumPy buffers before extending storage
    while len(data) % 4:
        data.append(0)
    offset = len(data)
    data.extend(poses.tobytes())
    m['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': poses.nbytes})
    m['accessors'].append({'bufferView': len(m['bufferViews']) - 1,
                            'componentType': 5126, 'count': len(poses),
                            'type': 'VEC3', 'min': poses.min(axis=0).astype(float).tolist(),
                            'max': poses.max(axis=0).astype(float).tolist()})
    sampler['output'] = len(m['accessors']) - 1
    channel['target']['path'] = 'translation'
    m.setdefault('asset', {}).setdefault('extras', {})['qwertyDepthBounce'] = {
        'step': 'Q1.3 correction',
        'model': 'deep head with upper housing bouncing straight up',
        'frontZ': .3, 'backZ': -1.25, 'basePlateBackZ': -1.26,
        'fixed': 'base_plate', 'moving': 'skull_upper and eye/lid descendants',
        'talkTrack': 'translation only', 'noMouth': True,
        'reference': 'two additional owner illustrations'}
    m['buffers'][0]['byteLength'] = len(data)
    js = json.dumps(m, separators=(',', ':'), ensure_ascii=True).encode()
    js += b' ' * ((-len(js)) % 4)
    data.extend(b'\0' * ((-len(data)) % 4))
    payload = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(data))
    payload += struct.pack('<I4s', len(js), b'JSON') + js
    payload += struct.pack('<I4s', len(data), b'BIN\0') + data
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(payload)
    print(f"Q1.3 bounce: {changed}, output={dst}, bytes={len(payload)}")

if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('input', type=Path)
    cli.add_argument('output', type=Path)
    a = cli.parse_args()
    build(a.input, a.output)
