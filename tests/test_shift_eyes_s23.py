"""S2.3: test the actual candidate GLB, not a procedural eye approximation."""
import math
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from shift_eyes_s23 import build
from test_shift_dome_s22 import unpack, attribute

S22 = ROOT / 'workbench/shift/Shift_S22.glb'
S23 = ROOT / 'workbench/shift/Shift_S23.glb'


class ShiftEyesS23(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a, cls.before = unpack(S22)
        cls.b, cls.after = unpack(S23)

    def test_source_art_bounds_and_thick_black_frames(self):
        g, blob = self.b, self.after
        def primitive(material):
            return next(p for p in g['meshes'][0]['primitives']
                        if g['materials'][p['material']]['name'] == material)
        ink = attribute(g, blob, primitive('Shift/Ink_Outline'), 'POSITION')
        white = attribute(g, blob, primitive('Shift/Eyes_2D_Emission'), 'POSITION')
        # Independently measured from S2.1 art rectangles, NOT from the patcher.
        expected = {
            'left': (-.2790744, 1.0157025, .0365455, 1.2216859),
            'right': (.1860496, 1.0223471, .5116364, 1.2316529),
        }
        for side, outline, inside in (
                ('left', ink[288:1152], white[:864]),
                ('right', ink[1152:2016], white[864:])):
            bounds = (min(p[0] for p in outline), min(p[1] for p in outline),
                      max(p[0] for p in outline), max(p[1] for p in outline))
            for actual, reference in zip(bounds, expected[side]):
                self.assertAlmostEqual(actual, reference, delta=1e-5)
            self.assertGreater(min(p[0] for p in inside), bounds[0]+.02)
            self.assertLess(max(p[0] for p in inside), bounds[2]-.02)
            self.assertGreater(min(p[1] for p in inside), bounds[1]+.02)
            self.assertLess(max(p[1] for p in inside), bounds[3]-.02)
            self.assertTrue(all(p[2] > .08 for p in inside))

    def test_no_independent_eye_joints_or_mesh_regressions(self):
        a, b = self.a, self.b
        for key in ('nodes', 'skins', 'animations', 'materials', 'scenes'):
            self.assertEqual(a[key], b[key], key)
        self.assertEqual([n['name'] for n in b['nodes']
                          if any(word in n['name'].lower()
                                 for word in ('eyelid', 'pupil', 'eye'))], [])
        for before, after in zip(a['meshes'][0]['primitives'],
                                 b['meshes'][0]['primitives']):
            name = b['materials'][after['material']]['name']
            for key in ('JOINTS_0', 'WEIGHTS_0', 'TEXCOORD_0'):
                self.assertEqual(attribute(a, self.before, before, key),
                                 attribute(b, self.after, after, key))
            pa = attribute(a, self.before, before, 'POSITION')
            pb = attribute(b, self.after, after, 'POSITION')
            if name not in ('Shift/Ink_Outline', 'Shift/Eyes_2D_Emission'):
                self.assertEqual(pa, pb, f'Non-eye geometry changed: {name}')
            for x, y, z in attribute(b, self.after, after, 'NORMAL'):
                self.assertTrue(math.isclose(math.hypot(x, y, z), 1, abs_tol=.001))
        prim = next(p for p in b['meshes'][0]['primitives']
                    if b['materials'][p['material']]['name'] == 'Shift/Eyes_2D_Emission')
        self.assertEqual({p[0] for p in attribute(b, self.after, prim, 'JOINTS_0')}, {3})
        self.assertEqual(b['asset']['extras']['shiftEyesS23']['modifiedVertices'], 3456)

    def test_rebuild_preserves_eye_art_geometry(self):
        with tempfile.TemporaryDirectory() as folder:
            generated = Path(folder) / 'shift.glb'
            self.assertEqual(build(S22, generated), 3456)
            g, data = unpack(generated)
            for key in ('nodes', 'skins', 'animations', 'materials', 'scenes'):
                self.assertEqual(g[key], self.b[key])
            for p, other in zip(g['meshes'][0]['primitives'],
                                self.b['meshes'][0]['primitives']):
                for key in ('POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0', 'TEXCOORD_0'):
                    x = attribute(g, data, p, key)
                    y = attribute(self.b, self.after, other, key)
                    self.assertEqual(len(x), len(y))
                    for left, right in zip(x, y):
                        for u, v in zip(left, right):
                            if key in ('POSITION', 'NORMAL'):
                                self.assertAlmostEqual(u, v, delta=2e-6)
                            else:
                                self.assertEqual(u, v)


if __name__ == '__main__':
    unittest.main()
