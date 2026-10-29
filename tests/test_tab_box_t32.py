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

    def test_unmodified_dress_and_bear_geometry_stays_byte_identical(self):
        expected = {
            'Tab/Dress_Dark': '9d57c0ff7b7908b97f4f3af3fe5e0567e8e3a8eb2f83666dc3052b78914877ad',
            'Tab/Dress_Main': '3a75a91938322eb43d10804092c295e3c69c93032b8681529f23a3917cf3c668',
            'Tab/Dress_Light': '8850c25481789f17f74b49caf5d1369466b77c53d529defeee638621e6bf2779',
            'Tab/Dress_Shadow': 'b91363ca74dbda930571ccdc8179f94ff67c940ba4a857ba657c16c414c79e89',
            'Tab/Bear': '56f13ee73839f399c08483d24edc77bf67454b188352dd26a9a108f2110b3d11',
            'Tab/Bear_Muzzle': '308c9ea237bcc6998080110c969a8648dac7602f7fbccedc15e4444c9ba72ec8',
            'Tab/Bear_Black': '5517994262bfc74a4d4d1f786595ac93feb1f1167e020b3703abcc08cde2510c',
        }
        # SHA-256 of attribute bytes in original exported order, before T3.2.
        for name, expected_hash in expected.items():
            h = hashlib.sha256()
            for index in self.parts[name]['attributes'].values():
                view = self.g['bufferViews'][self.g['accessors'][index]['bufferView']]
                off = view.get('byteOffset', 0)
                h.update(self.data[off:off+view['byteLength']])
            self.assertEqual(h.hexdigest(), expected_hash, name)

        # Shoe straps were intentionally reprofiled by T3.3; the cardboard
        # and printed ink remain protected by the cavity and image tests.

    def test_rig_clips_materials_and_prints_unchanged(self):
        import json
        rig = {k: self.g[k] for k in ['nodes', 'skins', 'animations', 'materials', 'scenes']}
        self.assertEqual(hashlib.sha256(json.dumps(rig, sort_keys=True).encode()).hexdigest(),
                         'ac8f9ca4e41b2e8658db6ec665ba1d290f8ffaaddf37cf19f426ef98f12b8bd0')
        expected = ['732077ec2814ad9a1f5a7362a29155f4165edbdf9a0e9c27a40eda3dbcc1ac12',
                    '29cea1ff5bf95003b6e0b3d0d6f01a61cead0b8c24f9442b4df876801b889e5f']
        self.assertEqual(len(self.g['images']), len(expected))
        for im, sha in zip(self.g['images'], expected):
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
