"""T3.5: independent GLB skin-weight, binding, UV and deformation gates."""
import unittest
from pathlib import Path
import numpy as np

from test_shift_dome_s22 import unpack,attribute

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'public/assets/characters/Tab_Reference.glb'

class TabSkinAndUV(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g,cls.data=unpack(MODEL)
        cls.parts={cls.g['materials'][p['material']]['name']:p
                   for p in cls.g['meshes'][0]['primitives']}
        cls.names=[cls.g['nodes'][n]['name'] for n in cls.g['skins'][0]['joints']]
        cls.index={name:i for i,name in enumerate(cls.names)}

    def rows(self,part,attribute_name):
        return np.asarray(attribute(self.g,self.data,self.parts['Tab/'+part],attribute_name))

    def test_weights_are_normalized_finite_and_in_range(self):
        for material in self.parts:
            p=self.parts[material]
            w=np.asarray(attribute(self.g,self.data,p,'WEIGHTS_0'))
            j=np.asarray(attribute(self.g,self.data,p,'JOINTS_0'))
            uv=np.asarray(attribute(self.g,self.data,p,'TEXCOORD_0'))
            self.assertTrue(np.isfinite(w).all(),material)
            self.assertTrue(np.isfinite(uv).all(),material)
            self.assertTrue((w>=0).all(),material)
            self.assertLess(np.max(np.abs(w.sum(axis=1)-1)),1e-5,material)
            self.assertTrue((j>=0).all() and (j<len(self.names)).all(),material)
            self.assertTrue((uv>=0).all() and (uv<=1).all(),material)
            self.assertEqual(w.shape[1],4)
            self.assertEqual(j.shape[1],4)

    def test_bending_joints_have_real_parent_blends(self):
        skin=self.rows('Skin','JOINTS_0')
        weights=self.rows('Skin','WEIGHTS_0')
        for side in ('L','R'):
            for child,parent in [('elbow','shoulder'),('wrist','elbow'),
                                 ('knee','hip'),('shoulder','chest')]:
                name=child+'.'+side
                above=parent+'.'+side if parent!='chest' else parent
                mask=(skin[:,0]==self.index[name])&(skin[:,1]==self.index[above])
                # Wrist seams are smaller than elbows/knees by design; a
                # narrow blended ring is sufficient without softening fingers.
                minimum=8 if child=='wrist' else 40
                self.assertGreater(np.sum(mask&(weights[:,1]>.05)),minimum,name)
                self.assertGreater(np.sum(mask&(weights[:,0]>.30)),minimum,name)

    def test_skirt_follows_hips_without_detaching_from_spine(self):
        ids=self.rows('Dress_Main','JOINTS_0')
        w=self.rows('Dress_Main','WEIGHTS_0')
        xyz=self.rows('Dress_Main','POSITION')
        low=xyz[:,1]<.85
        high=xyz[:,1]>1.28
        self.assertGreater(np.sum(low),1000)
        self.assertGreater(np.sum(high),100)
        self.assertTrue(np.all(ids[low,0]==self.index['spine']))
        self.assertTrue(np.all(ids[low,1]==self.index['hip.L']))
        self.assertTrue(np.all(ids[low,2]==self.index['hip.R']))
        self.assertGreater(np.mean(w[low,1]+w[low,2]),.08)
        self.assertLess(np.max(w[low,1]+w[low,2]),.141)
        self.assertTrue(np.all(w[high,0]>.995))

    def test_cardboard_bear_flats_and_hand_remain_rigid(self):
        for material,bone in [('Cardboard','head'),('Box_Face','head'),
                              ('Box_Side','head'),('Tape','head'),
                              ('Bear','bear'),('Bear_Shadow','bear'),
                              ('Bear_Muzzle','bear'),('Shoe','ankle.L')]:
            ids=self.rows(material,'JOINTS_0')
            w=self.rows(material,'WEIGHTS_0')
            self.assertTrue(np.allclose(w[:,0],1),material)
            self.assertTrue(np.allclose(w[:,1:],0),material)
            if material!='Shoe':self.assertTrue(np.all(ids[:,0]==self.index[bone]),material)
        ids=self.rows('Skin','JOINTS_0')
        w=self.rows('Skin','WEIGHTS_0')
        for side in ('L','R'):
            mask=ids[:,0]==self.index['hand.'+side]
            self.assertGreater(np.sum(mask),200)
            self.assertTrue(np.allclose(w[mask,0],1),side)

    def test_inverse_bind_rest_matrices_cancel_joint_translations(self):
        g=self.g
        skin=g['skins'][0]
        a=g['accessors'][skin['inverseBindMatrices']]
        view=g['bufferViews'][a['bufferView']]
        offset=view.get('byteOffset',0)+a.get('byteOffset',0)
        matrices=np.frombuffer(self.data,dtype='<f4',count=a['count']*16,offset=offset)
        self.assertEqual(a['count'],20)
        matrices=matrices.reshape((20,4,4)).transpose((0,2,1))
        parents={kid:i for i,n in enumerate(g['nodes']) for kid in n.get('children',[])}
        for slot,node_index in enumerate(skin['joints']):
            origin=np.zeros(3)
            ancestor=node_index
            while True:
                origin+=np.asarray(g['nodes'][ancestor].get('translation',[0,0,0]))
                if ancestor not in parents:break
                ancestor=parents[ancestor]
            m=matrices[slot]
            self.assertTrue(np.allclose(m[:3,:3],np.eye(3),atol=1e-6))
            self.assertTrue(np.allclose(m[:3,3]+origin,0,atol=1e-5),
                            g['nodes'][node_index]['name'])
            self.assertTrue(np.allclose(m[3],[0,0,0,1],atol=1e-6))

    def test_bent_elbow_has_continuous_not_rigid_response(self):
        j=self.rows('Skin','JOINTS_0')
        w=self.rows('Skin','WEIGHTS_0')
        xyz=self.rows('Skin','POSITION')
        mask=(j[:,0]==self.index['elbow.R'])&(j[:,1]==self.index['shoulder.R'])
        mask=mask&(w[:,1]>.08)&(w[:,1]<.70)
        self.assertGreater(mask.sum(),25)
        # Compare fixed reference landmarks using an elbow bend. Mixed vertices
        # move between the unchanged shoulder surface and rigid elbow rotation.
        p=xyz[mask]
        pivot=np.array([.33,1.35,.015])
        angle=.55
        rot=np.array([[np.cos(angle),-np.sin(angle),0],
                      [np.sin(angle), np.cos(angle),0],[0,0,1]])
        rigid=(p-pivot)@rot.T+pivot
        moved=p*w[mask,1,None]+rigid*w[mask,0,None]
        travel=np.linalg.norm(moved-p,axis=1)
        full=np.linalg.norm(rigid-p,axis=1)
        self.assertGreater(np.max(travel),.006)
        self.assertTrue((travel<=full+1e-5).all())
        self.assertGreater(np.median(full-travel),.0002)

if __name__=='__main__':
    unittest.main()
