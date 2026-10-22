"""Checks the deeper housing and vertical speech separation in Q1.3 candidate."""
import sys
import unittest
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from qwerty_head_hinge import unpack, arr

ASSET = Path(__file__).resolve().parents[1] / 'workbench/qwerty/Qwerty_Q13_depth_bounce.glb'

class QwertyDepthBounceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m, cls.b = unpack(ASSET)

    def test_skeleton_and_eye_bones(self):
        m = self.m
        self.assertEqual(len(m['skins'][0]['joints']), 19)
        self.assertEqual(m['nodes'][4]['name'], 'base_plate')
        self.assertEqual(m['nodes'][5]['name'], 'skull_upper')
        self.assertTrue({18,19}.issubset(set(m['nodes'][5]['children'])))
        self.assertEqual(len(m['animations']), 4)

    def test_front_is_flat_and_side_is_substantial(self):
        m,b=self.m,self.b
        h=m['skins'][0]['joints'].index(5)
        f=m['meshes'][0]['primitives'][0]
        s=m['meshes'][0]['primitives'][1]
        front=arr(m,b,f['attributes']['POSITION'])[arr(m,b,f['attributes']['JOINTS_0'])[:,0]==h]
        side=arr(m,b,s['attributes']['POSITION'])[arr(m,b,s['attributes']['JOINTS_0'])[:,0]==h]
        self.assertTrue(np.allclose(front[:,2], .30, atol=.002))
        self.assertGreater(float(np.ptp(side[:,2])), 1.50)

    def test_base_plate_stays_and_is_deep(self):
        m,b=self.m,self.b
        p=m['meshes'][0]['primitives'][1]
        base=m['skins'][0]['joints'].index(4)
        pts=arr(m,b,p['attributes']['POSITION'])
        joints=arr(m,b,p['attributes']['JOINTS_0'])
        fixed=pts[joints[:,0]==base]
        self.assertGreater(len(fixed),6)
        self.assertLess(float(fixed[:,2].min()),-1.25)
        self.assertTrue(np.all((fixed[:,1]>1.10)&(fixed[:,1]<1.18)))

    def test_talking_moves_vertically_not_rotation(self):
        m,b=self.m,self.b
        a=next(x for x in m['animations'] if x['name']=='Qwerty_Talk_Flap')
        target=[x for x in a['channels'] if x['target']['node']==5]
        self.assertEqual([x['target']['path'] for x in target],['translation'])
        track=arr(m,b,a['samplers'][target[0]['sampler']]['output'])
        self.assertGreater(float(np.ptp(track[:,1])),.60)
        self.assertTrue(np.allclose(track[:,0],0))
        self.assertTrue(np.allclose(track[:,2],-.26))
        self.assertTrue(np.allclose(track[0],track[-1]))

    def test_eyes_follow_whole_head(self):
        m,b=self.m,self.b
        p=m['meshes'][0]['primitives'][6]
        joints=arr(m,b,p['attributes']['JOINTS_0'])[:,0]
        self.assertTrue(np.all(joints==m['skins'][0]['joints'].index(5)))

if __name__=='__main__':
    unittest.main()
