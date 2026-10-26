"""S2.2: reference-silhouette gates and preservation of unrelated GLB data."""
import json
import math
import struct
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from shift_dome_s22 import build

SOURCE = ROOT / 'workbench/shift/Shift_Rigged_PreS28.glb'
CANDIDATE = ROOT / 'workbench/shift/Shift_S22.glb'


def unpack(path):
    b = path.read_bytes()
    if b[:4] != b'glTF' or struct.unpack_from('<II', b, 4) != (2, len(b)):
        raise ValueError('Invalid GLB')
    size = struct.unpack_from('<I', b, 12)[0]
    if b[16:20] != b'JSON':
        raise ValueError('Missing JSON')
    meta = json.loads(b[20:20+size]); off = 20+size
    length, marker = struct.unpack_from('<I4s', b, off)
    if marker != b'BIN\0' or off+8+length != len(b):
        raise ValueError('Invalid binary chunk')
    return meta, b[off+8:]


def attribute(meta, data, prim, name):
    acc = meta['accessors'][prim['attributes'][name]]
    view = meta['bufferViews'][acc['bufferView']]
    offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    component, width = {5126: ('f', 4), 5123: ('H', 2)}[acc['componentType']]
    count = {'VEC3': 3, 'VEC4': 4, 'VEC2': 2}[acc['type']]
    fmt = '<' + component * count
    stride = width * count
    return [struct.unpack_from(fmt, data, offset + i * stride) for i in range(acc['count'])]


class ShiftSilhouette(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original, cls.ob = unpack(SOURCE)
        cls.candidate, cls.cb = unpack(CANDIDATE)

    def test_reference_front_dome_proportions(self):
        g, b = self.candidate, self.cb
        by_name = {g['materials'][p['material']]['name']: p for p in g['meshes'][0]['primitives']}
        dome = attribute(g, b, by_name['Shift/Dome_Side'], 'POSITION')
        ink = attribute(g, b, by_name['Shift/Ink_Outline'], 'POSITION')
        joints = attribute(g, b, by_name['Shift/Ink_Outline'], 'JOINTS_0')
        x_min, x_max = min(p[0] for p in dome), max(p[0] for p in dome)
        y_min, y_max = min(p[1] for p in dome), max(p[1] for p in dome)
        # These target ratios came from the drawing's separate visible rectangles.
        torso_x = [p[0] for p,j in zip(ink,joints) if j[0] != 3]
        width, height = x_max-x_min, y_max-y_min
        self.assertGreater(width, 1.20)
        self.assertLess(width, 1.26)
        self.assertGreater(height, .73)
        self.assertLess(height, .77)
        self.assertAlmostEqual(width / height, 370/224, delta=.04)
        self.assertAlmostEqual(width / (max(torso_x)-min(torso_x)), 370/121, delta=.07)
        self.assertLessEqual(min(p[2] for p in dome), -.34)
        self.assertGreaterEqual(max(p[2] for p in dome), .34)

        # A bounding-box-only correction produced a pointed helmet.
        # Independently require broad shoulders high on the dome. The 75%
        # height band exists in the original 11-ring topology.
        shoulder = [abs(p[0]) for p in dome
                    if .74 < (p[1]-y_min)/height < .77]
        self.assertTrue(shoulder, 'missing upper-shoulder ring')
        self.assertGreater(max(shoulder), .39,
                           'dome still tapers into a pointed helmet')

    def test_rest_rig_uv_eyes_animations_body_untouched(self):
        a, x, b, y = self.original, self.ob, self.candidate, self.cb
        for name in ('nodes', 'skins', 'animations', 'materials', 'scenes'):
            self.assertEqual(a[name], b[name], name)
        self.assertEqual(len(x), len(y))
        head = b['skins'][0]['joints'].index(next(i for i,n in enumerate(b['nodes']) if n['name']=='head'))
        self.assertEqual(head, 3)
        for src, dst in zip(a['meshes'][0]['primitives'], b['meshes'][0]['primitives']):
            for field in ('TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'):
                self.assertEqual(attribute(a, x, src, field), attribute(b, y, dst, field))
            original_p = attribute(a, x, src, 'POSITION')
            candidate_p = attribute(b, y, dst, 'POSITION')
            joint = attribute(a, x, src, 'JOINTS_0')
            for old, new, bone in zip(original_p, candidate_p, joint):
                if bone[0] != head:
                    self.assertEqual(old, new)
                else:
                    self.assertEqual(old[2], new[2], 'dome depth stays unchanged')
            for nx, ny, nz in attribute(b, y, dst, 'NORMAL'):
                self.assertAlmostEqual(math.hypot(nx,ny,nz), 1., delta=.001)
        eyes = next(p for p in b['meshes'][0]['primitives'] if b['materials'][p['material']]['name']=='Shift/Eyes_2D_Emission')
        self.assertEqual({v[0] for v in attribute(b, y, eyes, 'JOINTS_0')}, {head})
        self.assertEqual(b['asset']['extras']['shiftDomeS22']['step'], 'S2.2')

    def test_source_generator_rebuilds_the_candidate(self):
        with tempfile.TemporaryDirectory() as folder:
            recreated = Path(folder) / 'candidate.glb'
            count = build(SOURCE, recreated)
            self.assertEqual(sum(count.values()), 9504)
            g, b = unpack(recreated)
            for key in ('skins', 'nodes', 'animations', 'materials', 'scenes'):
                self.assertEqual(g[key], self.candidate[key])
            for src, dst in zip(g['meshes'][0]['primitives'], self.candidate['meshes'][0]['primitives']):
                for label in ('POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0', 'TEXCOORD_0'):
                    first = attribute(g, b, src, label)
                    second = attribute(self.candidate, self.cb, dst, label)
                    self.assertEqual(len(first),len(second))
                    for u,v in zip(first,second):
                        for xx,yy in zip(u,v):
                            if label in ('POSITION', 'NORMAL'):
                                self.assertAlmostEqual(xx, yy, delta=2e-6)
                            else: self.assertEqual(xx,yy)


if __name__ == '__main__':
    unittest.main()

class ShiftQAServerPaths(unittest.TestCase):
    """Route real browser imports without exposing unrelated workbench files."""

    def test_loopback_qa_paths_and_traversal(self):
        from serve_shift_qa import ShiftQAHandler, ROOT
        handle = ShiftQAHandler.__new__(ShiftQAHandler)
        expected = {
            '/': ROOT / 'public' / 'index.html',
            '/boot3d.js': ROOT / 'public' / 'boot3d.js',
            '/assets/characters/Shift_Rigged.glb': ROOT / 'public' / 'assets' / 'characters' / 'Shift_Rigged.glb',
            '/workbench/shift/Shift_S22.glb': ROOT / 'workbench' / 'shift' / 'Shift_S22.glb',
            '/tests/visual/shift-s22.html': ROOT / 'tests' / 'visual' / 'shift-s22.html',
            '/public/vendor/GLTFLoader.js': ROOT / 'public' / 'vendor' / 'GLTFLoader.js',
        }
        for request, path in expected.items():
            self.assertEqual(Path(handle.translate_path(request)), path, request)
            self.assertTrue(path.is_file(), f'Missing browser asset: {request}')
        for path in ('/workbench/shift/../../.git/config',
                     '/tests/visual/../../.git/config',
                     '/%2e%2e/.git/config'):
            resolved = Path(handle.translate_path(path))
            self.assertFalse(resolved.is_file(), path)
            self.assertTrue(resolved.is_relative_to(ROOT / 'public'), path)
