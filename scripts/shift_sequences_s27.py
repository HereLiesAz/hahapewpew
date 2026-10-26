#!/usr/bin/env python3
"""S2.7: append independent root-turn and wrist-weapon clips to S2.6 Shift.

No geometry, UV, material, inverse bind, or old animation byte is touched.
The gun's deploy hinge/rotor remain separate Three.js scene-graph parts.
"""
import argparse
import json
import math
import struct
from pathlib import Path

CLIPS = (
    ("Shift_Turn", "root", "y", [0, .24, -.24, 0], [0, .34, .74, 1.12]),
    ("Shift_Weapon", "wrist.R", "z", [0, -.25, -.25, -.25], [0, .22, .60, 1]),
)


def build(source: Path, target: Path):
    source_bytes = source.read_bytes()
    if source_bytes[:4] != b"glTF" or struct.unpack_from("<II", source_bytes, 4) != (2, len(source_bytes)):
        raise ValueError("Invalid input GLB")
    json_len, kind = struct.unpack_from("<I4s", source_bytes, 12)
    if kind != b"JSON":
        raise ValueError("Missing JSON")
    gltf = json.loads(source_bytes[20:20+json_len])
    data_len, dtype = struct.unpack_from("<I4s", source_bytes, json_len+20)
    if dtype != b"BIN\0" or json_len+28+data_len != len(source_bytes):
        raise ValueError("Missing single aligned BIN chunk")
    if "shiftMaterialsS26" not in gltf["asset"].get("extras", {}):
        raise ValueError("Expected S2.6 material source")
    if [a["name"] for a in gltf["animations"]] != ["Shift_Walk", "Shift_Idle", "Shift_Talk"]:
        raise ValueError("Existing Shift animation sequence was changed")
    nodes = {node["name"]: i for i, node in enumerate(gltf["nodes"])}
    if not all(name in nodes for _, name, _, _, _ in CLIPS):
        raise ValueError("Missing turn/wrist targets")
    if len(gltf["skins"][0]["joints"]) != 16:
        raise ValueError("Changed skeleton size")
    data = bytearray(source_bytes[28+json_len:])
    old_binary_size = len(data)

    def add(values, shape):
        offset = len(data)
        data.extend(struct.pack("<" + "f"*len(values), *values))
        view_index = len(gltf["bufferViews"])
        gltf["bufferViews"].append({
            "buffer": 0, "byteOffset": offset, "byteLength": 4*len(values)
        })
        index = len(gltf["accessors"])
        accessory = {
            "bufferView": view_index,
            "componentType": 5126,
            "count": len(values) if shape == "SCALAR" else len(values)//4,
            "type": shape,
        }
        if shape == "SCALAR":
            accessory["min"] = [min(values)]
            accessory["max"] = [max(values)]
        gltf["accessors"].append(accessory)
        return index

    for name, bone, axis, angles, times in CLIPS:
        keys = add(times, "SCALAR")
        orientation = []
        for angle in angles:
            quaternion = [0., 0., 0., math.cos(angle/2)]
            quaternion[{"x": 0, "y": 1, "z": 2}[axis]] = math.sin(angle/2)
            orientation.extend(quaternion)
        rotation = add(orientation, "VEC4")
        gltf["animations"].append({
            "name": name,
            "channels": [{"sampler": 0, "target": {"node": nodes[bone], "path": "rotation"}}],
            "samplers": [{"input": keys, "output": rotation, "interpolation": "LINEAR"}],
        })
    gltf["buffers"][0]["byteLength"] = len(data)
    gltf["asset"].setdefault("extras", {})["shiftSequencesS27"] = {
        "step": "S2.7",
        "status": "candidate; actual browser and GLEE acceptance pending",
        "source": "workbench/shift/Shift_S26.glb",
        "actionNames": ["Shift_Walk", "Shift_Idle", "Shift_Talk", "Shift_Turn", "Shift_Weapon"],
        "sequenceDescription": {
            "Shift_Turn": "Root y rotation sampling 0, +.24, -.24, 0 radians",
            "Shift_Weapon": "Wrist.R z fold -0.25 radians held for deploy; retract via action blend",
        },
        "animatedBoneNames": ["root", "wrist.R"],
        "weaponGeometry": "public/shift-weapon.js separately attached to wristR",
        "preservedSourceBinaryPrefix": old_binary_size,
    }
    packed = json.dumps(gltf, separators=(",", ":"), ensure_ascii=True).encode("ascii")
    packed += b" " * (-len(packed) % 4)
    output = (struct.pack("<4sII", b"glTF", 2, 28+len(packed)+len(data))
              + struct.pack("<I4s", len(packed), b"JSON")+packed
              + struct.pack("<I4s", len(data), b"BIN\0")+data)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(output)
    return old_binary_size, len(data), tuple(a["name"] for a in gltf["animations"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    arguments = parser.parse_args()
    print(build(arguments.source, arguments.target))
