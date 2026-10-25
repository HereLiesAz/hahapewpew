#!/usr/bin/env python3
"""S2.6 export: preserve Shift's S2.4 skin and mesh, normalize cel-ready colors.

GLB does not natively express Three.js MeshToonMaterial. Export linear-sRGB
palette fallbacks plus KHR_materials_unlit fixed white eyes, and record the
four lighting bands used by public/cel-robots.js. No production asset swap.
"""
import argparse
import json
import math
import struct
from pathlib import Path

PALETTE = {
    "Dome_Graphite": "#85858a",
    "Dome_Side": "#77777d",
    "Ink_Outline": "#161618",
    "Body_Graphite": "#4e4d52",
    "Control_Light": "#aaa9a6",
    "Limb_Black": "#18181b",
    "Eyes_2D_Emission": "#ffffff",
}
BANDS = [120, 158, 211, 255]
EXPECTED_JOINTS = (
    "root", "spine", "neck", "head", "arm.L", "elbow.L",
    "wrist.L", "arm.R", "elbow.R", "wrist.R",
    "hip.L", "knee.L", "ankle.L", "hip.R", "knee.R", "ankle.R",
)
ATTRS = ("POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0")


def linear_channel(n):
    v = n / 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def rgba(hex_color):
    return [linear_channel(int(hex_color[i:i+2], 16)) for i in (1, 3, 5)] + [1]


def build(source: Path, destination: Path):
    data = source.read_bytes()
    if len(data) < 32 or data[:4] != b"glTF":
        raise ValueError("Not a binary glTF")
    version, size = struct.unpack_from("<II", data, 4)
    if version != 2 or size != len(data):
        raise ValueError("Invalid GLB header")
    jlen, jtype = struct.unpack_from("<I4s", data, 12)
    if jtype != b"JSON":
        raise ValueError("GLB JSON chunk required")
    meta = json.loads(data[20:20+jlen])
    blen, btype = struct.unpack_from("<I4s", data, 20+jlen)
    if btype != b"BIN\x00" or 28+jlen+blen != len(data):
        raise ValueError("GLB binary chunk malformed")
    buffer = data[28+jlen:]

    if "shiftLowerS24" not in meta["asset"].get("extras", {}):
        raise ValueError("Must build S2.6 on the S2.4 compact rig")
    if len(meta["skins"]) != 1 or len(meta["meshes"]) != 1:
        raise ValueError("Unexpected Shift rig layout")
    joint_nodes = meta["skins"][0]["joints"]
    if tuple(meta["nodes"][i]["name"] for i in joint_nodes) != EXPECTED_JOINTS:
        raise ValueError("Skeleton changed or joint names missing")
    if len(meta["nodes"]) != 18:
        raise ValueError("Ground-aligned stage missing")
    if [a["name"] for a in meta["animations"]] != [
        "Shift_Walk", "Shift_Idle", "Shift_Talk"
    ]:
        raise ValueError("Animations missing or renamed")

    def attr(index, typ, comp):
        a = meta["accessors"][index]
        view = meta["bufferViews"][a["bufferView"]]
        if a["type"] != typ or a["componentType"] != comp:
            raise ValueError("Invalid Shift attribute type")
        if view.get("byteStride"):
            raise ValueError("Unexpected interleaved attribute")
        offset = view.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = {"VEC2": 8, "VEC3": 12, "VEC4": 8}[typ]
        if comp == 5126 and typ == "VEC4":
            stride = 16
        if offset + stride*a["count"] > len(buffer):
            raise ValueError("Attribute extends beyond GLB binary")
        return a["count"], offset

    vertices = 0
    for primitive in meta["meshes"][0]["primitives"]:
        indexes = primitive["attributes"]
        if not all(k in indexes for k in ATTRS) or primitive.get("mode", 4) != 4:
            raise ValueError("Missing skinned triangle data")
        counts = [
            attr(indexes["POSITION"], "VEC3", 5126)[0],
            attr(indexes["NORMAL"], "VEC3", 5126)[0],
            attr(indexes["TEXCOORD_0"], "VEC2", 5126)[0],
            attr(indexes["JOINTS_0"], "VEC4", 5123)[0],
            attr(indexes["WEIGHTS_0"], "VEC4", 5126)[0],
        ]
        if len(set(counts)) != 1 or counts[0] % 3:
            raise ValueError("Incorrect primitive vertex counts")
        vertices += counts[0]

    if vertices != 11244:
        raise ValueError(f"Unexpected Shift mesh topology ({vertices} vertices)")
    if len(meta["materials"]) != len(PALETTE):
        raise ValueError("Unexpected material count")
    for material in meta["materials"]:
        name = material["name"]
        if not name.startswith("Shift/") or name[6:] not in PALETTE:
            raise ValueError(f"Unrecognized material {name!r}")
        key = name[6:]
        material["pbrMetallicRoughness"] = {
            "baseColorFactor": rgba(PALETTE[key]),
            "metallicFactor": 0,
            "roughnessFactor": 1,
        }
        material["doubleSided"] = True
        if key == "Eyes_2D_Emission":
            material["emissiveFactor"] = [1, 1, 1]
            material.setdefault("extensions", {})["KHR_materials_unlit"] = {}
        else:
            material.pop("emissiveFactor", None)
            if "extensions" in material:
                material["extensions"].pop("KHR_materials_unlit", None)

    meta["extensionsUsed"] = list(dict.fromkeys(
        meta.get("extensionsUsed", []) + ["KHR_materials_unlit"]
    ))
    meta["asset"].setdefault("extras", {})["shiftMaterialsS26"] = {
        "step": "S2.6",
        "status": "candidate; full tests, Chromium and cold independent review pending",
        "source": "workbench/shift/Shift_S24.glb",
        "palette": PALETTE,
        "renderRamp": {
            "bands": BANDS,
            "textureSize": [4, 1],
            "sampling": "nearest",
            "opaqueMeshType": "MeshToonMaterial",
            "eyeMeshType": "MeshBasicMaterial",
        },
        "preserve": [
            "all mesh geometry", "16-joint skin", "inverse bind matrices",
            "UV sets", "animations", "positions", "normals", "weights",
        ],
        "weapon": "public/shift-weapon.js remains a separately attached scene-graph candidate",
        "requiredExtension": "KHR_materials_unlit",
    }
    # Unicode metadata from S2.4 is serialized as escaped JSON to preserve
    # exact GLB offsets while leaving the original binary chunk untouched.
    result = json.dumps(meta, separators=(",", ":"), ensure_ascii=True).encode("ascii")
    result += b" " * (-len(result) % 4)
    output = (
        struct.pack("<4sII", b"glTF", 2, 12+8+len(result)+8+len(buffer))
        + struct.pack("<I4s", len(result), b"JSON") + result
        + struct.pack("<I4s", len(buffer), b"BIN\x00") + buffer
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(output)
    return len(meta["materials"]), vertices


if __name__ == "__main__":
    arg = argparse.ArgumentParser()
    arg.add_argument("source", type=Path)
    arg.add_argument("destination", type=Path)
    args = arg.parse_args()
    print("materials, vertices:", build(args.source, args.destination))
