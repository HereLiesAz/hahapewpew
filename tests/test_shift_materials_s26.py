"""S2.6: GLB layout, palette, unlit eyes, rig and reproducibility regression."""
import math
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from shift_materials_s26 import build, PALETTE, BANDS, rgba
from test_shift_dome_s22 import unpack, attribute

SOURCE = ROOT / "workbench/shift/Shift_S24.glb"
CANDIDATE = ROOT / "workbench/shift/Shift_S26.glb"


class ShiftCelExport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original, cls.ob = unpack(SOURCE)
        cls.candidate, cls.cb = unpack(CANDIDATE)

    def test_binary_geometry_skin_and_animations_are_bitwise_preserved(self):
        # Stronger than approximate equality: not even one vertex, UV, weight,
        # bind matrix, or sampled clip accessor is permitted to move.
        a, b = self.original, self.candidate
        self.assertEqual(self.ob, self.cb)
        for key in ("accessors", "bufferViews", "meshes", "skins", "nodes",
                    "animations", "scenes", "buffers"):
            self.assertEqual(a[key], b[key], key)
        self.assertEqual(len(a["skins"][0]["joints"]), 16)
        self.assertEqual([clip["name"] for clip in b["animations"]],
                         ["Shift_Walk", "Shift_Idle", "Shift_Talk"])
        self.assertEqual(len(b["meshes"][0]["primitives"]), 7)
        self.assertEqual(b["asset"]["extras"]["shiftMaterialsS26"]["step"], "S2.6")

    def test_material_palette_and_unlit_eyes(self):
        b = self.candidate
        self.assertIn("KHR_materials_unlit", b["extensionsUsed"])
        self.assertEqual(len(b["materials"]), 7)
        by_name = {m["name"]: m for m in b["materials"]}
        self.assertEqual(set(by_name), {"Shift/" + n for n in PALETTE})
        for key, hex_color in PALETTE.items():
            material = by_name["Shift/" + key]
            self.assertEqual(material["doubleSided"], True)
            pbr = material["pbrMetallicRoughness"]
            for x, y in zip(pbr["baseColorFactor"], rgba(hex_color)):
                self.assertAlmostEqual(x, y, delta=1e-7)
            self.assertEqual(pbr["metallicFactor"], 0)
            self.assertEqual(pbr["roughnessFactor"], 1)
            if key == "Eyes_2D_Emission":
                self.assertEqual(material["emissiveFactor"], [1, 1, 1])
                self.assertEqual(material["extensions"]["KHR_materials_unlit"], {})
            else:
                self.assertNotIn("KHR_materials_unlit", material.get("extensions", {}))
                self.assertNotIn("emissiveFactor", material)
        ramp = b["asset"]["extras"]["shiftMaterialsS26"]["renderRamp"]
        self.assertEqual(ramp["bands"], BANDS)
        self.assertEqual(ramp["sampling"], "nearest")
        self.assertEqual(ramp["eyeMeshType"], "MeshBasicMaterial")

    def test_skin_vertex_attributes_valid_and_white_face_is_static(self):
        b, data = self.candidate, self.cb
        head = b["skins"][0]["joints"].index(next(
            i for i, n in enumerate(b["nodes"]) if n["name"] == "head"))
        total = 0
        for prim in b["meshes"][0]["primitives"]:
            name = b["materials"][prim["material"]]["name"]
            fields = ("POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0")
            for field in fields:
                self.assertIn(field, prim["attributes"])
            vals = {key: attribute(b, data, prim, key) for key in fields}
            counts = {len(array) for array in vals.values()}
            self.assertEqual(len(counts), 1, name)
            total += len(vals["POSITION"])
            for uv in vals["TEXCOORD_0"]:
                self.assertTrue(all(math.isfinite(x) for x in uv))
            for joints, weights in zip(vals["JOINTS_0"], vals["WEIGHTS_0"]):
                self.assertTrue(all(0 <= joint < 16 for joint in joints))
                self.assertAlmostEqual(sum(weights), 1, delta=1e-6)
            for normal in vals["NORMAL"]:
                self.assertAlmostEqual(math.hypot(*normal), 1, delta=1e-3)
            if name == "Shift/Eyes_2D_Emission":
                self.assertEqual({j[0] for j in vals["JOINTS_0"]}, {head})
        self.assertEqual(total, 11244)
        for clip in b["animations"]:
            for ch in clip["channels"]:
                bone = b["nodes"][ch["target"]["node"]]["name"]
                self.assertNotIn("eye", bone.lower())
                self.assertNotIn("lid", bone.lower())

    def test_rebuild_has_identical_material_and_binary_content(self):
        with tempfile.TemporaryDirectory() as temp:
            rebuilt = Path(temp) / "S26.glb"
            self.assertEqual(build(SOURCE, rebuilt), (7, 11244))
            metadata, binary = unpack(rebuilt)
            self.assertEqual(binary, self.cb)
            self.assertEqual(metadata["materials"], self.candidate["materials"])
            self.assertEqual(metadata["extensionsUsed"], self.candidate["extensionsUsed"])
            self.assertEqual(metadata["asset"]["extras"]["shiftMaterialsS26"],
                             self.candidate["asset"]["extras"]["shiftMaterialsS26"])


if __name__ == "__main__":
    unittest.main()
