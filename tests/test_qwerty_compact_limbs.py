"""Q1.4: verify compact limbs, planted feet, preserved head/skinning."""
import unittest,sys,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from qwerty_compact_limbs import read,access
OLD=ROOT/'workbench/qwerty/Qwerty_Q14_centered.glb'
NEW=ROOT/'workbench/qwerty/Qwerty_Q14_compact.glb'
class CompactRigTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.a,cls.ab=read(OLD);cls.m,cls.b=read(NEW)
 def test_head_untouched_and_vertical_speech(self):
  self.assertEqual(self.m['nodes'][4:6],self.a['nodes'][4:6])
  self.assertEqual([a['name'] for a in self.a['animations']],[a['name'] for a in self.m['animations']])
  talk=next(a for a in self.m['animations'] if a['name']=='Qwerty_Talk_Flap')
  self.assertEqual([ch['target']['path'] for ch in talk['channels'] if ch['target']['node']==5],['translation'])
 def test_bones_and_textures_retained(self):
  self.assertEqual(len(self.m['skins'][0]['joints']),19)
  self.assertEqual(self.a.get('textures',[]),self.m.get('textures',[]))
  self.assertEqual(self.a['meshes'][0]['primitives'][0],self.m['meshes'][0]['primitives'][0])
  self.assertEqual(self.m['nodes'][4]['translation'][2],.475)
 def test_reduced_limb_pivots_and_larger_clamps(self):
  n={x['name']:x for x in self.m['nodes']};old={x['name']:x for x in self.a['nodes']}
  self.assertLess(abs(n['wrist.L']['translation'][0]),abs(old['wrist.L']['translation'][0]))
  self.assertGreater(n['wrist.L']['translation'][1],old['wrist.L']['translation'][1])
  self.assertGreater(n['ankle.L']['translation'][1],old['ankle.L']['translation'][1])
  self.assertEqual(self.m['asset']['extras']['qwertyCompactRig']['clampScale'],1.63)
 def test_feet_touch_ground_and_side_rig_preserved(self):
  p=next(p for p in self.m['meshes'][0]['primitives'] if self.m['materials'][p['material']]['name']=='Qwerty/Limb_Black')
  po=access(self.m,p['attributes']['POSITION']);jo=access(self.m,p['attributes']['JOINTS_0'])
  names=[x['name'] for x in self.m['nodes']];joints=self.m['skins'][0]['joints']
  ys=[]
  for i in range(self.m['accessors'][p['attributes']['POSITION']]['count']):
   bone=joints[struct.unpack_from('<H',self.b,jo+i*8)[0]]
   if names[bone].startswith('ankle.'):ys.append(struct.unpack_from('<3f',self.b,po+i*12)[1])
  self.assertGreater(len(ys),30);self.assertAlmostEqual(min(ys),0,places=3)
if __name__=='__main__':unittest.main()
