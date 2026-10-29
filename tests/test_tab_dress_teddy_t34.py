"""T3.4 independently checks exported skirt drape and held teddy placement."""
import sys
import unittest
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_reference_tab import J
from test_shift_dome_s22 import unpack,attribute

class TabDressBear(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g,cls.data=unpack(ROOT/'public/assets/characters/Tab_Reference.glb')
        cls.parts={cls.g['materials'][p['material']]['name']:p for p in cls.g['meshes'][0]['primitives']}

    def points(self,material,joint=None):
        p=self.parts['Tab/'+material]
        vertices=np.asarray(attribute(self.g,self.data,p,'POSITION'))
        if joint is None:return vertices
        joints=np.asarray(attribute(self.g,self.data,p,'JOINTS_0'))
        return vertices[joints[:,0]==J[joint]]

    def test_right_hem_is_lower_than_left_and_folds_are_distinct(self):
        skirt=self.points('Dress_Main')
        low=skirt[skirt[:,1]<.82]
        right=low[low[:,0]>.32]
        left=low[low[:,0]<-.32]
        self.assertGreater(len(right),20)
        self.assertGreater(len(left),20)
        self.assertLess(right[:,1].min(),left[:,1].min()-.15)
        self.assertGreater(len(self.points('Dress_Light')),800)
        self.assertGreater(len(self.points('Dress_Shadow')),1100)

    def test_bear_is_suspended_by_left_ear_near_right_hand(self):
        hand=self.points('Skin','hand.R')
        plush=self.points('Bear','bear')
        self.assertGreater(len(plush),2000)
        # Source-art grip landmark: right hand lies against the bear's left ear.
        ear=np.array([.348,.973,.109])
        distance=np.linalg.norm(hand-ear,axis=1).min()
        self.assertLess(distance,.06)
        self.assertLess(plush[:,1].min(),.57)
        self.assertGreater(plush[:,1].max(),1.02)
        self.assertGreater(len(self.points('Bear_Shadow')),0)

    def test_box_print_skinning_and_movement_channels_survive(self):
        self.assertEqual(len(self.g['images']),2)
        self.assertEqual(len(self.g['skins'][0]['joints']),20)
        self.assertEqual([c['name'] for c in self.g['animations']],
                         ['Tab_Walk','Tab_Idle','Tab_Bear_Swing'])
        box=self.points('Box_Face','head')
        self.assertEqual(len(box),6)
        self.assertGreater(len(self.points('Dress_Dark')),200)

if __name__=='__main__':unittest.main()
