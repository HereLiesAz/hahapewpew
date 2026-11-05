"""Victoria replacement gates: original costume geometry untouched, 20-joint body real."""
import hashlib
import json
import struct
import unittest
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
CANDIDATE = ROOT / 'public/assets/characters/Tab_Victoria.glb'
REFERENCE = ROOT / 'public/assets/characters/Tab_Reference.glb'
EXPECTED_SOURCE = 'ba3853fe4c68f613a69240c4de782b931b9730adfd94049242afd2e94ed89eca'
EXPECTED_FACE = '732077ec2814ad9a1f5a7362a29155f4165edbdf9a0e9c27a40eda3dbcc1ac12'
EXPECTED_SIDE = '29cea1ff5bf95003b6e0b3d0d6f01a61cead0b8c24f9442b4df876801b889e5f'


def read(path):
    content = path.read_bytes()
    assert content[:4] == b'glTF' and struct.unpack_from('<I', content, 8)[0] == len(content)
    length = struct.unpack_from('<I', content, 12)[0]
    assert content[16:20] == b'JSON' and content[24+length:28+length] == b'BIN\0'
    return json.loads(content[20:20+length]), content[28+length:]


def accessor(g, data, i):
    a = g['accessors'][i]
    v = g['bufferViews'][a['bufferView']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']]
    offset = v.get('byteOffset', 0)+a.get('byteOffset', 0)
    return np.frombuffer(data, dtype=dtype, count=a['count']*width,
                         offset=offset).reshape(-1, width)


def image_bytes(g, blob, i):
    v = g['bufferViews'][g['images'][i]['bufferView']]
    start = v.get('byteOffset', 0)
    return blob[start:start+v['byteLength']]


class TabVictoria(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original, cls.before = read(REFERENCE)
        cls.output, cls.after = read(CANDIDATE)
        cls.base_parts = {cls.original['materials'][p['material']]['name']: p
                          for p in cls.original['meshes'][0]['primitives']}
        cls.parts = {cls.output['materials'][p['material']]['name']: p
                     for p in cls.output['meshes'][0]['primitives']}

    def test_exact_source_and_same_original_tab_costume(self):
        origin = self.output['asset']['extras']['sourceModel']
        self.assertEqual(origin['assetBaseId'], '1fcc4446-1992-48ec-a160-9cd73ee35158')
        self.assertEqual(origin['creator'], 'Rex Mun')
        self.assertEqual(origin['sourceSHA256'], EXPECTED_SOURCE)
        self.assertEqual(set(self.parts), set(self.base_parts))
        for key in sorted(self.base_parts):
            if key == 'Tab/Skin':
                continue
            old, new = self.base_parts[key], self.parts[key]
            self.assertEqual(set(old['attributes']), set(new['attributes']), key)
            for attr in old['attributes']:
                np.testing.assert_array_equal(
                    accessor(self.original, self.before, old['attributes'][attr]),
                    accessor(self.output, self.after, new['attributes'][attr]),
                    err_msg=f'{key} {attr}')
        for index, sha in enumerate((EXPECTED_FACE, EXPECTED_SIDE)):
            self.assertEqual(hashlib.sha256(image_bytes(self.output, self.after, index)).hexdigest(), sha)
            self.assertEqual(image_bytes(self.original, self.before, index),
                             image_bytes(self.output, self.after, index))
        for index in range(2, 5):
            self.assertEqual(image_bytes(self.original, self.before, index),
                             image_bytes(self.output, self.after, index))

    def test_genuine_rigged_child_body_with_own_uv_and_skin_texture(self):
        g = self.output
        self.assertEqual(len(g['skins']), 1)
        self.assertEqual(len(g['skins'][0]['joints']), 20)
        body = self.parts['Tab/Skin']
        p = accessor(g, self.after, body['attributes']['POSITION'])
        uv = accessor(g, self.after, body['attributes']['TEXCOORD_0'])
        joints = accessor(g, self.after, body['attributes']['JOINTS_0'])
        weights = accessor(g, self.after, body['attributes']['WEIGHTS_0'])
        faces = accessor(g, self.after, body['indices']).ravel()
        self.assertEqual(p.shape, (6438, 3))
        self.assertEqual(uv.shape, (6438, 2))
        # Covered scalp and bodice must not intersect Tab's cardboard and dress.
        # Original Victoria source has 11,252 triangles; exposed child geometry
        # must be substantially less while preserving the forearms and legs.
        self.assertGreater(faces.size, 6500*3)
        self.assertLess(faces.size, 10500*3)
        self.assertGreater(p[:,1].max(), 2.05)  # source vertices remain available
        self.assertLess(faces.max(), len(p))
        self.assertTrue(np.isfinite(p).all())
        self.assertTrue((uv >= 0).all() and (uv <= 1).all())
        self.assertTrue((joints >= 0).all() and (joints < 20).all())
        np.testing.assert_allclose(weights.sum(axis=1), 1, atol=1e-5)
        self.assertGreater(np.count_nonzero(weights[:, 1] > .02), 300)
        self.assertEqual([im['name'] for im in g['images'][-2:]],
                         ['Victoria/body_BaseColor','Victoria/body_Normal'])
        skinmat = g['materials'][body['material']]
        self.assertIn('baseColorTexture', skinmat['pbrMetallicRoughness'])
        self.assertIn('normalTexture', skinmat)
        self.assertGreater(p[:, 1].max(), 2.05)
        self.assertLess(p[:, 1].min(), .04)
        self.assertGreater(p[:, 0].max(), .30)
        self.assertLess(p[:, 0].min(), -.30)

    def test_original_dress_and_bear_pose_survive(self):
        g = self.output
        self.assertEqual([a['name'] for a in g['animations']],
                         ['Tab_Walk', 'Tab_Idle', 'Tab_Bear_Swing'])
        dress = accessor(g, self.after, self.parts['Tab/Dress_Main']['attributes']['POSITION'])
        body = accessor(g, self.after, self.parts['Tab/Skin']['attributes']['POSITION'])
        bear = accessor(g, self.after, self.parts['Tab/Bear']['attributes']['POSITION'])
        self.assertLess(dress[:, 1].min(), .55)
        self.assertGreater(dress[:, 1].max(), 1.36)
        self.assertGreater(bear[:, 0].mean(), .5)
        self.assertLess(np.min(np.linalg.norm(body - np.array([.348,.973,.109]), axis=1)), .18)
        shoe = accessor(g, self.after, self.parts['Tab/Shoe']['attributes']['POSITION'])
        self.assertLess(shoe[:, 1].min(), .01)

    def test_only_leg_bind_transforms_changed(self):
        before = self.original['nodes']; after = self.output['nodes']
        self.assertEqual([n['name'] for n in before], [n['name'] for n in after])
        self.assertEqual(len(self.output['skins'][0]['joints']), 20)
        leg = {'hip.L', 'hip.R', 'knee.L', 'knee.R', 'ankle.L', 'ankle.R'}
        for a, b in zip(before, after):
            if a['name'] not in leg:
                self.assertEqual(a, b, a['name'])

if __name__ == '__main__':
    unittest.main()