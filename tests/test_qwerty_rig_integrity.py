"""Q1.6: validate the candidate skin and visual rest-pose equivalence."""
import sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from qwerty_rig_integrity import load,rows,audit,rest_positions
OLD=ROOT/'workbench/qwerty/Qwerty_Q15_rim_eyelids.glb'
NEW=ROOT/'workbench/qwerty/Qwerty_Q16_validated.glb'
class QwertyRigIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a,cls.ab=load(OLD);cls.b,cls.bb=load(NEW)
    def test_inverse_bind_matrices_all_match_rest_skeleton(self):
        errors=audit(self.b,self.bb)
        self.assertEqual(len(errors),19)
        self.assertTrue(all(e<1e-5 for e in errors.values()),errors)
    def test_vertex_weights_indices_and_uvs(self):
        self.assertEqual(len(self.b['skins'][0]['joints']),19)
        self.assertEqual(len(self.b['meshes'][0]['primitives']),8)
        self.assertEqual(len(self.b['animations']),6)
        self.assertTrue(audit(self.b,self.bb))
    def test_visual_rest_pose_is_byte_level_equivalent(self):
        a,b=self.a,self.b
        before=rest_positions(a['nodes']);after=rest_positions(b['nodes'])
        self.assertEqual(a['nodes'],b['nodes'])
        joints=a['skins'][0]['joints']
        ibma=[x for _,x in rows(a,self.ab,a['skins'][0]['inverseBindMatrices'])]
        ibmb=[x for _,x in rows(b,self.bb,b['skins'][0]['inverseBindMatrices'])]
        for p,q in zip(a['meshes'][0]['primitives'],b['meshes'][0]['primitives']):
            coords=[x for _,x in rows(a,self.ab,p['attributes']['POSITION'])]
            fixed=[x for _,x in rows(b,self.bb,q['attributes']['POSITION'])]
            jid=[x[0] for _,x in rows(a,self.ab,p['attributes']['JOINTS_0'])]
            self.assertEqual(len(coords),len(fixed))
            for c,n,j in zip(coords,fixed,jid):
                node=joints[j]
                for k in range(3):
                    old=c[k]+before[node][k]+ibma[j][12+k]
                    new=n[k]+after[node][k]+ibmb[j][12+k]
                    self.assertAlmostEqual(old,new,places=5)
    def test_generator_produces_byte_identical_glb(self):
        import tempfile
        from qwerty_rig_integrity import repair
        with tempfile.TemporaryDirectory() as directory:
            rebuilt=Path(directory)/'Q16.glb'
            repair(OLD,rebuilt)
            self.assertEqual(rebuilt.read_bytes(),NEW.read_bytes())
    def test_eye_rims_animation_uvs_and_materials_preserved(self):
        self.assertEqual(self.a['animations'],self.b['animations'])
        self.assertEqual(self.a['materials'],self.b['materials'])
        self.assertEqual(self.a['nodes'],self.b['nodes'])
        self.assertEqual(self.b['asset']['extras']['qwertyRigQ16']['affectedVertices'],840)
        self.assertEqual(self.b['asset']['extras']['qwertyRigQ16']['step'],'Q1.6')
if __name__=='__main__':unittest.main()
