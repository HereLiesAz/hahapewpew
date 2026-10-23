"""Q1.5 correction: black eye outlines ARE the animated lids, not eyebrows."""
from pathlib import Path
import math,sys,unittest
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from qwerty_eye_rims import read,get
OLD=ROOT/'workbench/qwerty/Qwerty_Q15_eyes.glb'
NEW=ROOT/'workbench/qwerty/Qwerty_Q15_rim_eyelids.glb'
class RimEyes(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.m,cls.bin=read(NEW);cls.old,cls.oldbin=read(OLD)
 def test_flat_featureless_eyes_both_larger(self):
  m,b=self.m,self.bin
  p=m['meshes'][0]['primitives'][6];eyes=get(m,b,p['attributes']['POSITION'])
  self.assertEqual(len(eyes),192)
  self.assertTrue(all(abs(v[2]-.321)<1e-5 for v in eyes))
  for x in (-.45,.45):
   pts=[v for v in eyes if abs(v[0]-x)<.34]
   self.assertAlmostEqual(max(v[1] for v in pts)-min(v[1] for v in pts),.65,places=3)
  e=m['materials'][p['material']]
  self.assertEqual(e['emissiveFactor'],[1,1,1])
  self.assertEqual(e['pbrMetallicRoughness']['baseColorFactor'][:3],[1,1,1])
  self.assertEqual(m['asset']['extras']['qwertyEyesQ15Correction']['whiteRadius'],.325)
 def test_black_rims_are_thick_and_lids_share_ink(self):
  m,b=self.m,self.bin;p=m['meshes'][0]['primitives']
  self.assertEqual(m['materials'][p[2]['material']]['pbrMetallicRoughness']['baseColorFactor'],
   m['materials'][p[7]['material']]['pbrMetallicRoughness']['baseColorFactor'])
  pts=get(m,b,p[2]['attributes']['POSITION'])
  self.assertTrue(any(abs(v[1]-(1.87+.418))<1e-5 and abs(v[2]-.315)<1e-5 for v in pts))
  self.assertGreater(.418-.325,.09)
 def test_separate_curved_caps_retract_and_cover(self):
  m,b=self.m,self.bin
  p=m['meshes'][0]['primitives'][7];vertices=get(m,b,p['attributes']['POSITION'])
  bones=get(m,b,p['attributes']['JOINTS_0'])
  self.assertEqual(len(vertices),120)
  self.assertTrue(all(abs(v[2]-.28)<1e-5 for v in vertices))
  self.assertEqual(set(int(j[0]) for j in bones),{17,18})
  for bone,name in ((18,'Qwerty_Left_Lid'),(19,'Qwerty_Right_Lid')):
   clip=next(c for c in m['animations'] if c['name']==name)
   self.assertEqual([ch['target'] for ch in clip['channels']],[{'node':bone,'path':'translation'}])
  both=next(c for c in m['animations'] if c['name']=='Qwerty_Suspicious_Lids')
  self.assertEqual({ch['target']['node'] for ch in both['channels']},{18,19})
 def test_other_character_geometry_and_head_bounce_preserved(self):
  a=self.m;b=self.old
  self.assertEqual(a['nodes'],b['nodes']);self.assertEqual(a['skins'],b['skins'])
  self.assertEqual(len(a['animations']),len(b['animations']))
  self.assertEqual([x['name'] for x in a['animations']],[x['name'] for x in b['animations']])
  for i in (0,1,3,4,5):self.assertEqual(a['meshes'][0]['primitives'][i],b['meshes'][0]['primitives'][i])
  self.assertEqual(a['nodes'][4]['translation'][2],.475)
  talk=next(c for c in a['animations'] if c['name']=='Qwerty_Talk_Flap')
  self.assertEqual([x['target']['path'] for x in talk['channels'] if x['target']['node']==5],['translation'])
if __name__=='__main__':unittest.main()
