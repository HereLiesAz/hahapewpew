"""S2.4: source-derived full-body proportions, rest foot contact and rigid skin."""
import math
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from shift_body_s24 import build
from test_shift_dome_s22 import unpack, attribute

SOURCE = ROOT / "workbench/shift/Shift_S23.glb"
CANDIDATE = ROOT / "workbench/shift/Shift_S24.glb"


def jointed(g, data, name):
    p = next(p for p in g["meshes"][0]["primitives"]
             if g["materials"][p["material"]]["name"] == name)
    return (attribute(g, data, p, "POSITION"),
            attribute(g, data, p, "JOINTS_0"))


class ShiftBodyS24(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a, cls.ab = unpack(SOURCE)
        cls.b, cls.bb = unpack(CANDIDATE)

    def test_original_art_proportions_and_rest_foot_contact(self):
        g, data = self.b, self.bb
        meta = g["asset"]["extras"]["shiftLowerS24"]
        feet_offset = -meta["worldFloorShift"]
        self.assertAlmostEqual(feet_offset, .3811405, delta=.002)
        self.assertEqual(g["scenes"][g.get("scene", 0)]["nodes"], [17])
        wrapper = g["nodes"][17]
        self.assertEqual(wrapper["children"], [0, 1])
        self.assertEqual(wrapper["name"], "Shift.S24.GroundAlign")
        self.assertAlmostEqual(wrapper["translation"][1], -feet_offset, delta=1e-6)
        dom, _ = jointed(g, data, "Shift/Dome_Side")
        lower = min(v[1] for v in dom)
        upper = max(v[1] for v in dom)
        head = upper-lower
        standing = upper-feet_offset
        self.assertAlmostEqual(head/standing, 224/388, delta=.002)
        torso, torso_bones = jointed(g, data, "Shift/Ink_Outline")
        trunk = [v[1] for v, joints in zip(torso, torso_bones) if joints[0] == 1]
        self.assertAlmostEqual(head/(max(trunk)-min(trunk)), 224/111, delta=.1)
        limbs, joints = jointed(g, data, "Shift/Limb_Black")
        for ankle in (12, 15):
            foot = [v for v, b in zip(limbs, joints) if b[0] == ankle]
            self.assertEqual(len(foot), 36)
            self.assertAlmostEqual(min(v[1] for v in foot)-feet_offset, 0, delta=2e-6)
            # The source's dark wedge feet are retained, not replaced by cubes.
            self.assertGreater(max(v[2] for v in foot)-min(v[2] for v in foot), .20)
            self.assertGreater(max(v[0] for v in foot)-min(v[0] for v in foot), .14)
        self.assertLess(max(v[1] for v in limbs)-feet_offset, .6)

    def test_preserved_head_face_arms_clips_and_skin_weights(self):
        g, data = self.b, self.bb
        old, original = self.a, self.ab
        self.assertEqual(g["materials"], old["materials"])
        self.assertEqual(g["animations"], old["animations"])
        self.assertEqual(g["skins"][0]["joints"], old["skins"][0]["joints"])
        self.assertEqual(g["meshes"], old["meshes"])
        self.assertEqual(len(g["nodes"]), len(old["nodes"])+1)
        for before, after in zip(old["meshes"][0]["primitives"], g["meshes"][0]["primitives"]):
            name = g["materials"][after["material"]]["name"]
            for key in ("TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"):
                self.assertEqual(attribute(old, original, before, key),
                                 attribute(g, data, after, key))
            old_points = attribute(old, original, before, "POSITION")
            new_points = attribute(g, data, after, "POSITION")
            old_bones = attribute(old, original, before, "JOINTS_0")
            changed_count = 0
            for a, b, bones in zip(old_points, new_points, old_bones):
                self.assertEqual(a[0], b[0], name)
                self.assertEqual(a[2], b[2], name)
                if bones[0] in (0, 2, 3):
                    self.assertEqual(a[1], b[1], name)
                elif a[1] != b[1]:
                    changed_count += 1
            if name in ("Shift/Body_Graphite", "Shift/Control_Light"):
                self.assertGreater(changed_count, 0)
            for v in attribute(g, data, after, "NORMAL"):
                self.assertAlmostEqual(math.hypot(*v), 1, delta=.002)

    def test_rest_joint_bind_matrices_remain_valid(self):
        g = self.b
        nodes = g["nodes"]
        skin = g["skins"][0]
        self.assertEqual(len(skin["joints"]), 16)
        parent = {child: index for index, node in enumerate(nodes)
                  for child in node.get("children", [])}
        def absolute(i):
            return nodes[i].get("translation", [0, 0, 0])[1] + (
                absolute(parent[i]) if i in parent and parent[i] != 17 else 0)
        # The additional stage root translates the skeleton and the mesh together.
        offsets = g["asset"]["extras"]["shiftLowerS24"]["rigRest"]
        for i, joint in enumerate(skin["joints"]):
            self.assertAlmostEqual(absolute(joint), offsets[i]["to"], delta=2e-6)
        # Inverse bind matrix y-translation equals the negative rest joint Y.
        acc = g["accessors"][skin["inverseBindMatrices"]]
        view = g["bufferViews"][acc["bufferView"]]
        start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        import struct
        for i, joint in enumerate(skin["joints"]):
            y = struct.unpack_from("<f", self.bb, start+64*i+13*4)[0]
            self.assertAlmostEqual(y, -offsets[i]["to"], delta=2e-6)

    def test_generator_matches_stored_candidate(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "recreated.glb"
            self.assertEqual(build(SOURCE, path),
                             {"body": 144, "arms": 936, "legs": 504, "untouched": 9660})
            g, data = unpack(path)
            self.assertEqual(g["animations"], self.b["animations"])
            self.assertEqual(g["scenes"], self.b["scenes"])
            self.assertEqual(g["skins"], self.b["skins"])
            self.assertEqual(len(g["nodes"]), len(self.b["nodes"]))
            for p, expected in zip(g["meshes"][0]["primitives"],
                                   self.b["meshes"][0]["primitives"]):
                for key in ("POSITION", "NORMAL", "JOINTS_0", "WEIGHTS_0", "TEXCOORD_0"):
                    actual = attribute(g, data, p, key)
                    reference = attribute(self.b, self.bb, expected, key)
                    for v, wanted in zip(actual, reference):
                        for x, y in zip(v, wanted):
                            if key in ("POSITION", "NORMAL"):
                                self.assertAlmostEqual(x, y, delta=2e-6)
                            else:
                                self.assertEqual(x, y)


if __name__ == "__main__":
    unittest.main()
