"""S2.7: additive animation export, immutable original mesh and clip checks."""
import math
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from shift_sequences_s27 import build
from test_shift_dome_s22 import unpack, attribute

SOURCE=ROOT/'workbench/shift/Shift_S26.glb'
CANDIDATE=ROOT/'workbench/shift/Shift_S27.glb'


class ShiftS27Sequences(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.before,cls.before_bin=unpack(SOURCE)
        cls.after,cls.after_bin=unpack(CANDIDATE)

    def test_preserve_every_original_accessor_and_source_clip(self):
        a,b=self.before,self.after
        self.assertEqual(self.after_bin[:len(self.before_bin)],self.before_bin)
        for key in ('nodes','meshes','skins','scenes','materials'):
            self.assertEqual(a[key],b[key],key)
        self.assertEqual(b['accessors'][:len(a['accessors'])],a['accessors'])
        self.assertEqual(b['bufferViews'][:len(a['bufferViews'])],a['bufferViews'])
        self.assertEqual(b['animations'][:len(a['animations'])],a['animations'])
        self.assertEqual(len(b['skins'][0]['joints']),16)
        self.assertEqual(len(b['animations']),5)
        self.assertEqual([a['name'] for a in b['animations']],
            ['Shift_Walk','Shift_Idle','Shift_Talk','Shift_Turn','Shift_Weapon'])
        self.assertEqual(b['asset']['extras']['shiftSequencesS27']
                         ['preservedSourceBinaryPrefix'],len(self.before_bin))

    def test_turn_and_weapon_actions_have_valid_joint_quaternions(self):
        b=self.after
        names={node['name']:i for i,node in enumerate(b['nodes'])}
        for anim_name,node_name,axis in (('Shift_Turn','root',1),
                                        ('Shift_Weapon','wrist.R',2)):
            clip=next(a for a in b['animations'] if a['name']==anim_name)
            self.assertEqual(len(clip['channels']),1)
            channel=clip['channels'][0]
            self.assertEqual(channel['target'],{
                'node':names[node_name],'path':'rotation'})
            sample=clip['samplers'][channel['sampler']]
            self.assertEqual(sample['interpolation'],'LINEAR')
            inp=b['accessors'][sample['input']]
            out=b['accessors'][sample['output']]
            self.assertEqual(inp['count'],4)
            self.assertEqual(out['count'],4)
            self.assertEqual(inp['type'],'SCALAR')
            self.assertEqual(out['type'],'VEC4')
            # Quaternions are in a newly appended separate accessor.
            import struct
            av=b['bufferViews'][out['bufferView']]
            offset=av.get('byteOffset',0)+out.get('byteOffset',0)
            samples=[struct.unpack_from('<4f',self.after_bin,offset+i*16)
                     for i in range(4)]
            for q in samples:
                self.assertAlmostEqual(math.hypot(*q),1,delta=1e-6)
                for i,x in enumerate(q[:3]):
                    if i!=axis:self.assertAlmostEqual(x,0,delta=1e-8)
            self.assertGreater(abs(samples[1][axis]),.10)

    def test_generator_reproducible_geometry_and_tracks(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'rebuilt.glb'
            before,after,names=build(SOURCE,output)
            self.assertEqual(before,len(self.before_bin))
            self.assertEqual(after,len(self.after_bin))
            self.assertEqual(names,tuple(a['name'] for a in self.after['animations']))
            meta,binary=unpack(output)
            self.assertEqual(binary,self.after_bin)
            for key in ('accessors','bufferViews','animations','skins','scenes'):
                self.assertEqual(meta[key],self.after[key])


if __name__=='__main__':
    unittest.main()
