"""T3.2: actual exported shell opening, flap thickness and preservation gates."""
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
import numpy as np
from test_shift_dome_s22 import unpack, attribute

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_reference_tab import build, Writer, J


class TabBox(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g, cls.data = unpack(ROOT / 'public/assets/characters/Tab_Reference.glb')
        cls.parts = {cls.g['materials'][p['material']]['name']: p
                     for p in cls.g['meshes'][0]['primitives']}

    def positions(self, name):
        return np.array(attribute(self.g, self.data, self.parts[name], 'POSITION'))

    def test_underside_open_with_thin_walls_and_closed_roof(self):
        triangles = self.positions('Tab/Cardboard').reshape(-1, 3, 3)
        # Intersect a vertical ray through the cavity, not through a shoulder/flap.
        hits = []
        x, z = .1, .05
        for tri in triangles:
            a, b, c = tri
            matrix = np.stack(((b-a)[[0, 2]], (c-a)[[0, 2]]), axis=1)
            if abs(np.linalg.det(matrix)) < 1e-10:
                continue
            u, v = np.linalg.solve(matrix, np.array([x, z])-a[[0, 2]])
            if u >= 0 and v >= 0 and u+v <= 1:
                hits.append(a[1]+u*(b-a)[1]+v*(c-a)[1])
        self.assertEqual(len(hits), 2, hits)
        self.assertAlmostEqual(min(hits), 2.526, places=5)
        self.assertAlmostEqual(max(hits)-min(hits), .008, places=5)
        # Inner and outer faces exist on both side walls; a solid cube lacks these.
        xs = self.positions('Tab/Cardboard')[:, 0]
        for x in [-.349, -.341, .341, .349]:
            self.assertTrue(np.any(np.isclose(xs, x, atol=1e-7)), x)

    def test_four_independent_open_flaps_have_real_edge_faces(self):
        # Inspect the generated blocks, then reproduce all exported vertex attributes below.
        b = build()
        all_blocks = [p for blocks in b.parts.values() for p in blocks if p[3] == J['head']]
        for label, axis, limit, sign in [('front', 2, .68, 1), ('rear', 2, -.45, -1),
                                         ('left', 0, -.67, -1), ('right', 0, .59, 1)]:
            matches = [(v, f) for v, f, _, _ in all_blocks
                       if np.max(v[:, axis]*sign) > limit*sign and len(f) == 12]
            self.assertEqual(len(matches), 1, label)
            v, f = matches[0]
            self.assertEqual(len(v), 8, label)
            self.assertGreater(np.min(np.linalg.norm(v[:4]-v[4:], axis=1)), .007, label)
            # Closed slab topology: every undirected edge is shared by two triangles.
            edges = {}
            for tri in f:
                for a, c in zip(tri, np.roll(tri, -1)):
                    key = tuple(sorted((int(a), int(c))))
                    edges[key] = edges.get(key, 0)+1
            self.assertTrue(all(n == 2 for n in edges.values()), label)

    def test_cardboard_scope_is_exclusive_to_head_skinning(self):
        # T3.3/T3.4 legitimately resculpt body, dress and bear. This legacy
        # box regression must protect the head cardboard rather than freeze
        # the rest of the model's vertex buffers.
        for name in ('Tab/Cardboard','Tab/Cardboard_Light','Tab/Box_Face','Tab/Box_Side','Tab/Tape'):
            prim=self.parts[name]
            joints=np.array(attribute(self.g,self.data,prim,'JOINTS_0'))
            self.assertTrue(np.all(joints[:,0]==J['head']),name)

    def test_rig_clips_materials_and_prints_unchanged(self):
        import json
        # Bear_Shadow adds an accessor before the skin matrices, changing
        # the metadata index but not the binding. Assert the actual skeleton.
        self.assertEqual(self.g['skins'][0]['joints'], list(range(1,21)))
        self.assertEqual(self.g['skins'][0]['skeleton'],1)
        self.assertEqual([n['name'] for n in self.g['nodes'][1:]],
                         ['root','spine','chest','neck','head',
                          'shoulder.L','elbow.L','wrist.L','hand.L',
                          'shoulder.R','elbow.R','wrist.R','hand.R','bear',
                          'hip.L','knee.L','ankle.L','hip.R','knee.R','ankle.R'])
        self.assertEqual([v['name'] for v in self.g['animations']],
                         ['Tab_Walk','Tab_Idle','Tab_Bear_Swing'])
        expected = ['732077ec2814ad9a1f5a7362a29155f4165edbdf9a0e9c27a40eda3dbcc1ac12',
                    '29cea1ff5bf95003b6e0b3d0d6f01a61cead0b8c24f9442b4df876801b889e5f']
        self.assertEqual([im['name'] for im in self.g['images']],
                         ['Box_Face','Box_Side','Dress_Main','Dress_Dark','Dress_Light'])
        for im, sha in zip(self.g['images'][:2], expected):
            view = self.g['bufferViews'][im['bufferView']]
            off = view.get('byteOffset', 0)
            self.assertEqual(hashlib.sha256(self.data[off:off+view['byteLength']]).hexdigest(), sha)

    def test_generator_reproduces_exported_geometry_and_rig(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'tab.glb'
            Writer().export(path, build())
            g, data = unpack(path)
        for key in ['nodes', 'skins', 'animations', 'materials', 'scenes']:
            self.assertEqual(g[key], self.g[key], key)
        self.assertEqual(len(g['meshes'][0]['primitives']), len(self.g['meshes'][0]['primitives']))
        for a, b in zip(g['meshes'][0]['primitives'], self.g['meshes'][0]['primitives']):
            for name in a['attributes']:
                self.assertEqual(attribute(g, data, a, name),
                                 attribute(self.g, self.data, b, name), name)
