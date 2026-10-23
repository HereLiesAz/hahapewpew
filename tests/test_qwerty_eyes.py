"""Q1.5 fidelity: flat emissive eyes, unequal graphic circles, independent 2D lids."""
import unittest,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from qwerty_eyes import read
OLD=ROOT/'workbench/qwerty/Qwerty_Q14_compact.glb'
NEW=ROOT/'workbench/qwerty/Qwerty_Q15_eyes.glb'
def positions(m,b,i):
    p=m['meshes'][0]['primitives'][i];a=m['accessors'][p['attributes']['POSITION']]
    v=m['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0)
    return list(struct.iter_unpack('<fff',b[start:start+12*a['count']]))
class QwertyEyeFidelity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.m,cls.b=read(NEW);cls.prev,cls.before=read(OLD)
    def test_white_flat_discs_and_eye_size(self):
        m,b=self.m,self.b;e=m['materials'][6]
        self.assertEqual(e['name'],'Qwerty/Eyes_2D_Emission')
        self.assertEqual(e['emissiveFactor'],[1,1,1])
        self.assertEqual(e['pbrMetallicRoughness']['baseColorFactor'][:3],[1,1,1])
        eye=positions(m,b,6);left=[v for v in eye if v[0]<0];right=[v for v in eye if v[0]>0]
        self.assertEqual((len(left),len(right)),(120,120))
        self.assertTrue(all(abs(p[2]-.321)<1e-4 for p in eye))
        self.assertAlmostEqual((max(p[1] for p in left)-min(p[1] for p in left))/2,.236,places=3)
        self.assertAlmostEqual((max(p[1] for p in right)-min(p[1] for p in right))/2,.236*.82,places=3)
        self.assertAlmostEqual((max(p[1] for p in right)+min(p[1] for p in right))/2,1.87,places=3)
        self.assertEqual(m['materials'][2]['name'],'Qwerty/Outline')
    def test_lids_animate_independently(self):
        m,b=self.m,self.b
        self.assertEqual((m['nodes'][18]['name'],m['nodes'][19]['name']),('eyelidL','eyelidR'))
        for bone,name in [(18,'Qwerty_Left_Lid'),(19,'Qwerty_Right_Lid')]:
            a=next(x for x in m['animations'] if x['name']==name)
            self.assertEqual([x['target'] for x in a['channels']],[{'node':bone,'path':'translation'}])
        lids=positions(m,b,7)
        self.assertTrue(all(abs(v[2]-.28)<1e-4 for v in lids))
        self.assertTrue(all(v[2]<.3 for v in lids))
    def test_head_bounce_and_body_unchanged(self):
        m,p=self.m,self.prev
        self.assertEqual(m['nodes'],p['nodes'])
        self.assertEqual(m['skins'],p['skins'])
        self.assertEqual(m['meshes'][0]['primitives'][0],p['meshes'][0]['primitives'][0])
        self.assertEqual([a['name'] for a in m['animations'][:4]],[a['name'] for a in p['animations']])
        talk=next(a for a in m['animations'] if a['name']=='Qwerty_Talk_Flap')
        self.assertEqual(next(c['target']['path'] for c in talk['channels'] if c['target']['node']==5),'translation')
        self.assertEqual(m['nodes'][4]['translation'][2],.475)
    def test_kill_mode_reuses_same_surfaces(self):
        m=self.m
        self.assertEqual(len(m['materials']),8)
        self.assertEqual(len(m['meshes'][0]['primitives']),8)
        self.assertIn('kill-mode',m['asset']['extras']['qwertyEyesQ15']['eyeMaterials'])
if __name__=='__main__':unittest.main()
