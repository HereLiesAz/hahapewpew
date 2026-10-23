"""Check Qwerty centered-head candidate preserves rig/geometry while correcting depth."""
import copy,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from qwerty_center_head import read_glb
SRC=ROOT/'workbench/qwerty/Qwerty_Q13_depth_bounce.glb'
DST=ROOT/'workbench/qwerty/Qwerty_Q14_centered.glb'
class QwertyCenteredHead(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.before,cls.original_bin=read_glb(SRC)
        cls.after,cls.bin=read_glb(DST)
    def test_head_and_torso_depth_centers_match(self):
        meta=self.after['asset']['extras']['qwertyDepthBounce']
        z=self.after['nodes'][4]['translation'][2]
        self.assertAlmostEqual((meta['frontZ']+z+meta['backZ']+z)/2,0,places=5)
        self.assertAlmostEqual(z,.475,places=5)
        self.assertEqual(self.after['nodes'][2]['translation'][2],0)
        self.assertEqual(self.after['nodes'][4]['translation'][:2],[0,.3])
    def test_plate_and_eyes_follow_entire_head(self):
        n=self.after['nodes']
        self.assertIn(5,n[4]['children'])
        self.assertTrue({18,19}.issubset(n[5]['children']))
        self.assertEqual(n[3],self.before['nodes'][3])
    def test_only_static_head_bone_changes(self):
        old=copy.deepcopy(self.before)
        old['nodes'][4]['translation']=self.after['nodes'][4]['translation']
        old['asset']['extras']['qwertyCenteredHead']=self.after['asset']['extras']['qwertyCenteredHead']
        self.assertEqual(old,self.after)
        self.assertEqual(self.original_bin,self.bin)
        self.assertEqual(len(self.after['skins'][0]['joints']),19)
    def test_talk_remains_straight_up_no_jaw(self):
        a=next(a for a in self.after['animations'] if a['name']=='Qwerty_Talk_Flap')
        self.assertEqual([ch['target']['path'] for ch in a['channels'] if ch['target']['node']==5],['translation'])
        self.assertEqual(len(self.after['animations']),4)
if __name__=='__main__':unittest.main()
