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
        altered={
            'Tab/Dress_Main':{'JOINTS_0','WEIGHTS_0'},
            'Tab/Dress_Dark':{'POSITION','NORMAL','JOINTS_0','WEIGHTS_0'},
            'Tab/Dress_Light':{'JOINTS_0','WEIGHTS_0'},
            'Tab/Dress_Shadow':{'JOINTS_0','WEIGHTS_0'},
            'Tab/Dress_Dirt':{'JOINTS_0','WEIGHTS_0'},
            'Tab/Shoe':{'POSITION','NORMAL'},
            'Tab/Ink':{'POSITION','NORMAL'},
        }
        for key in sorted(self.base_parts):
            if key == 'Tab/Skin':
                continue
            original, new = self.base_parts[key], self.parts[key]
            self.assertEqual(set(original['attributes']), set(new['attributes']), key)
            for attr in original['attributes']:
                if attr in altered.get(key,set()):
                    continue
                np.testing.assert_array_equal(
                    accessor(self.original, self.before, original['attributes'][attr]),
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

    def test_victoria_shins_connect_to_low_ankles_beneath_the_knees(self):
        """Visible body geometry, not only joint names, must reach the shoes."""
        g=self.output
        body=self.parts['Tab/Skin']
        xyz=accessor(g,self.after,body['attributes']['POSITION'])
        joints=accessor(g,self.after,body['attributes']['JOINTS_0'])
        weights=accessor(g,self.after,body['attributes']['WEIGHTS_0'])
        names=[g['nodes'][n]['name'] for n in g['skins'][0]['joints']]
        for side,expected_x in (('L',-.135),('R',.135)):
            knee=names.index('knee.'+side)
            ankle=names.index('ankle.'+side)
            # The vertical reference bands are independently defined by the
            # authored dress/shoe dimensions, not by the retarget algorithm.
            leg=xyz[np.isin(joints[:,0],[knee,ankle]) & (weights[:,0]>.5)]
            lower=leg[(leg[:,1]>.19)&(leg[:,1]<.31)]
            upper=leg[(leg[:,1]>.49)&(leg[:,1]<.61)]
            self.assertGreater(len(lower),15,side+' missing exposed lower shin')
            self.assertGreater(len(upper),15,side+' missing anatomical upper shin')
            for band in (lower,upper):
                self.assertLess(abs(np.median(band[:,0])-expected_x),.17,
                                side+' shin is displaced from the real ankle line')
                self.assertLess(abs(np.median(band[:,2])-.034),.19,
                                side+' shin protrudes sideways from the shoe')
            self.assertLess(abs(np.median(lower[:,0])-np.median(upper[:,0])),.13,
                            side+' shin bends like an extra hind-leg segment')

    def test_ankle_weights_start_at_the_foot_not_halfway_up_the_calf(self):
        """Ankle-controlled skin must end below the actual human shin."""
        body=self.parts['Tab/Skin']
        xyz=accessor(self.output,self.after,body['attributes']['POSITION'])
        ids=accessor(self.output,self.after,body['attributes']['JOINTS_0'])
        weights=accessor(self.output,self.after,body['attributes']['WEIGHTS_0'])
        names=[self.output['nodes'][n]['name']
               for n in self.output['skins'][0]['joints']]
        for side in ('L','R'):
            ankle=names.index('ankle.'+side)
            knee=names.index('knee.'+side)
            foot=xyz[(ids[:,0]==ankle)&(weights[:,0]>.5)]
            calf=xyz[(ids[:,0]==knee)&(weights[:,0]>.5)]
            self.assertGreater(len(foot),100,side+' must retain a real foot')
            self.assertGreater(len(calf),110,side+' must retain the full shin')
            self.assertLess(foot[:,1].max(),.23,
                side+' ankle skin includes mid-calf; lower shin was assigned to foot')
            self.assertLess(calf[:,1].min(),.22,
                side+' lower shin must extend to the anatomical ankle')
            self.assertGreater(calf[:,1].max(),.61,
                side+' shin must still connect to the real knee')

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

    def test_skirt_moves_with_hips_and_thigh_skin_stays_covered(self):
        part=self.parts['Tab/Dress_Main']
        xyz=accessor(self.output,self.after,part['attributes']['POSITION'])
        weights=accessor(self.output,self.after,part['attributes']['WEIGHTS_0'])
        names=[self.output['nodes'][n]['name'] for n in self.output['skins'][0]['joints']]
        ids=accessor(self.output,self.after,part['attributes']['JOINTS_0'])
        hem=xyz[:,1]<.70
        self.assertGreater(hem.sum(),1000)
        hip_l=names.index('hip.L');hip_r=names.index('hip.R')
        self.assertTrue(np.all(ids[hem,1]==hip_l))
        self.assertTrue(np.all(ids[hem,2]==hip_r))
        self.assertGreater(np.mean(weights[hem,1]+weights[hem,2]),.25)
        # No hidden thigh triangles remain visible through the torn dress.
        body=self.parts['Tab/Skin']
        pos=accessor(self.output,self.after,body['attributes']['POSITION'])
        bone=accessor(self.output,self.after,body['attributes']['JOINTS_0'])
        face=accessor(self.output,self.after,body['indices']).ravel()
        visible=np.unique(face)
        hip=np.isin(bone[visible,0],[hip_l,hip_r])
        self.assertFalse(np.any(hip&(pos[visible,1]>.76)))

    def test_flats_enclose_the_feet_with_grounded_soles(self):
        shoe=accessor(self.output,self.after,self.parts['Tab/Shoe']['attributes']['POSITION'])
        previous=accessor(self.original,self.before,
                          self.base_parts['Tab/Shoe']['attributes']['POSITION'])
        self.assertLess(abs(float(shoe[:,1].min())),.005)
        self.assertGreater(shoe[:,1].max(),.15)
        self.assertGreater(shoe[:,1].max(),previous[:,1].max()+.045)
        self.assertTrue(np.allclose(shoe[:,0],previous[:,0]))
        self.assertTrue(np.allclose(shoe[:,2],previous[:,2]))

    def test_bear_rotates_at_its_held_ear_not_above_the_hand(self):
        nodes=self.output['nodes']
        parents={child:i for i,node in enumerate(nodes) for child in node.get('children',[])}
        def world(index):
            p=np.asarray(nodes[index].get('translation',[0,0,0]))
            return p+world(parents[index]) if index in parents else p
        bear=next(i for i,n in enumerate(nodes) if n['name']=='bear')
        palm=next(i for i,n in enumerate(nodes) if n['name']=='hand.R')
        pivot=world(bear)
        held=np.array([.348,.973,.109])
        self.assertLess(np.linalg.norm(pivot-held),.012)
        self.assertLess(np.linalg.norm(pivot-world(palm)),.07)
        self.assertEqual(parents[bear],palm)

    def test_reshaped_shoes_and_sleeves_have_updated_unit_normals(self):
        for material in ('Tab/Shoe','Tab/Dress_Dark'):
            original=self.base_parts[material];out=self.parts[material]
            old=accessor(self.original,self.before,original['attributes']['NORMAL'])
            normal=accessor(self.output,self.after,out['attributes']['NORMAL'])
            xyz=accessor(self.output,self.after,out['attributes']['POSITION'])
            self.assertTrue(np.isfinite(normal).all(),material)
            lengths=np.linalg.norm(normal,axis=1)
            self.assertGreater(np.mean((lengths>.97)&(lengths<1.03)),.99,material)
            self.assertGreater(np.mean(np.linalg.norm(normal-old,axis=1)>.025),.10,material)
            triangles=xyz.reshape(-1,3,3)
            faces=np.cross(triangles[:,1]-triangles[:,0],
                           triangles[:,2]-triangles[:,0])
            face_lengths=np.linalg.norm(faces,axis=1)
            valid=face_lengths>1e-8
            face_normals=faces[valid]/face_lengths[valid,None]
            vertex_normals=normal.reshape(-1,3,3)[valid]
            agreement=np.einsum('ij,ikj->ik',face_normals,vertex_normals)
            self.assertGreater(np.mean(agreement>.20),.96,material)

    def test_tailored_sleeves_are_no_longer_identical_radius_rods(self):
        old=self.base_parts['Tab/Dress_Dark'];new=self.parts['Tab/Dress_Dark']
        previous=accessor(self.original,self.before,old['attributes']['POSITION'])
        positions=accessor(self.output,self.after,new['attributes']['POSITION'])
        self.assertEqual(previous.shape,positions.shape)
        # Alter the shoulder caps and cuff silhouettes on both arms while
        # keeping the original bodice, UVs and texture artwork recognizable.
        for side in (-1,1):
            sleeve=(positions[:,0]*side>.20)&(positions[:,1]>1.49)
            self.assertGreater(sleeve.sum(),200)
            changed=np.linalg.norm(positions[sleeve]-previous[sleeve],axis=1)
            self.assertGreater(np.sum(changed>.004),50)

    def test_only_leg_bind_transforms_changed(self):
        before = self.original['nodes']; after = self.output['nodes']
        self.assertEqual([n['name'] for n in before], [n['name'] for n in after])
        self.assertEqual(len(self.output['skins'][0]['joints']), 20)
        leg = {'hip.L', 'hip.R', 'knee.L', 'knee.R', 'ankle.L', 'ankle.R', 'bear'}
        for a, b in zip(before, after):
            if a['name'] not in leg:
                self.assertEqual(a, b, a['name'])

if __name__ == '__main__':
    unittest.main()