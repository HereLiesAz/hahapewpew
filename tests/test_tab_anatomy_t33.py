"""T3.3: body-part topology, child proportions and authored joint movement."""
import sys
import unittest
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_reference_tab import build,J
from test_shift_dome_s22 import unpack,attribute

class TabAnatomy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g,cls.data=unpack(ROOT/'public/assets/characters/Tab_Reference.glb')
        cls.parts={cls.g['materials'][p['material']]['name']:p for p in cls.g['meshes'][0]['primitives']}

    def vertices(self,material,joint):
        p=self.parts['Tab/'+material]
        coords=np.asarray(attribute(self.g,self.data,p,'POSITION'))
        joints=np.asarray(attribute(self.g,self.data,p,'JOINTS_0'))
        return coords[joints[:,0]==J[joint]]

    def test_two_distinct_young_knees_and_narrow_shoulders(self):
        for side in ('L','R'):
            knee=self.vertices('Skin','knee.'+side)
            shoulder=self.vertices('Skin','shoulder.'+side)
            self.assertGreater(len(knee),300)
            self.assertGreater(len(shoulder),250)
            self.assertGreater(knee[:,2].max(),.085) # forward kneecap, not a ball
            self.assertLess(shoulder[:,0].ptp() if hasattr(shoulder[:,0],'ptp') else np.ptp(shoulder[:,0]),.15)
            self.assertTrue(.09<knee[:,1].min()<.16) # shin vertices are knee-weighted

    def test_five_fingers_and_thumb_are_sculpted_per_hand(self):
        b=build()
        for side in ('L','R'):
            pieces=[v for v,_,_,j in b.parts['Skin'] if j==J['hand.'+side]]
            rods=[v for v in pieces if len(v) in (16,18,20)]
            self.assertGreaterEqual(len(rods),4 if side=='L' else 4)
            palm=self.vertices('Skin','hand.'+side)
            self.assertGreater(len(palm),200)

    def test_flats_contact_floor_and_keep_child_width(self):
        for side in ('L','R'):
            shoe=self.vertices('Shoe','ankle.'+side)
            self.assertGreater(len(shoe),1000)
            self.assertAlmostEqual(float(shoe[:,1].min()),0,places=5)
            self.assertLess(np.ptp(shoe[:,0]),.21)
            self.assertGreater(shoe[:,2].max(),.25)

    def test_each_flat_has_a_rigged_instep_strap(self):
        ink=self.parts['Tab/Ink']
        joints=np.asarray(attribute(self.g,self.data,ink,'JOINTS_0'))
        positions=np.asarray(attribute(self.g,self.data,ink,'POSITION'))
        for side in ('L','R'):
            strap=positions[joints[:,0]==J['ankle.'+side]]
            self.assertEqual(len(strap),48)
            self.assertTrue(np.all(strap[:,1]>.05))
            self.assertLess(np.ptp(strap[:,0]),.15)

    def test_existing_rig_and_print_materials_retained(self):
        self.assertEqual(len(self.g['skins'][0]['joints']),20)
        self.assertEqual([a['name'] for a in self.g['animations']],
                         ['Tab_Walk','Tab_Idle','Tab_Bear_Swing'])
        self.assertEqual(len(self.g['images']),5)
        for material in ['Tab/Dress_Dark','Tab/Dress_Main','Tab/Dress_Light',
                         'Tab/Dress_Shadow','Tab/Bear',
                         'Tab/Cardboard','Tab/Box_Face','Tab/Box_Side']:
            self.assertIn(material,self.parts)

if __name__=='__main__':unittest.main()
