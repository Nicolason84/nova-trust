#!/usr/bin/env python3
"""Independent structural verifier for the Nicolas Gamehouse V2 GLB.

It does not import the exporter. It compares the GLB against the recovered USDA,
checks the 40-joint skin, filtered native primitives, curved face shell, embedded
local texture and 1.75 m rest bounds. Visual likeness remains a Human Gate.
"""
from __future__ import annotations

import ast
import hashlib
import json
import math
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / "docs/assets/nicolas-avatar/nicolas-canonical-v2.glb"
SOURCE = ROOT / "docs/assets/nicolas-avatar/source-v2/Nicolas.usda"
CUTOUT = ROOT / "PROOF/NICOLAS_GAMEHOUSE_V1_20261005/avatar-v2/nicolas-face-cutout-v2.png"
OUTPUT = ROOT / "PROOF/NICOLAS_GAMEHOUSE_V1_20261005/GLB_V2_INDEPENDENT_VALIDATION.json"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_array(text: str, key: str):
    match = re.search(re.escape(key) + r" = (\[.*?\])", text)
    assert match, key
    return ast.literal_eval(match.group(1))


def head_morph(vertex):
    x, y, z = vertex
    if 1.49 < y < 1.83:
        return x * 1.27, 1.82 - (1.82 - y) * 0.90, z * 1.04
    return vertex


def main() -> None:
    blob = GLB.read_bytes()
    magic, version, length = struct.unpack_from("<III", blob)
    assert magic == 0x46546C67 and version == 2 and length == len(blob)
    json_size, json_kind = struct.unpack_from("<II", blob, 12)
    assert json_kind == 0x4E4F534A
    gltf = json.loads(blob[20 : 20 + json_size])
    binary_offset = 20 + json_size
    bin_size, bin_kind = struct.unpack_from("<II", blob, binary_offset)
    assert bin_kind == 0x004E4942
    binary = blob[binary_offset + 8 :]
    assert len(binary) == bin_size == gltf["buffers"][0]["byteLength"]

    components = {5121: "B", 5123: "H", 5125: "I", 5126: "f"}
    widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

    def read_accessor(index: int):
        accessor = gltf["accessors"][index]
        view = gltf["bufferViews"][accessor["bufferView"]]
        width = widths[accessor["type"]]
        fmt = components[accessor["componentType"]]
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        count = accessor["count"] * width
        return struct.unpack_from("<" + fmt * count, binary, start)

    source = SOURCE.read_text()
    joint_paths = source_array(source, "uniform token[] joints")
    bind = source_array(source, "uniform matrix4d[] bindTransforms")
    assert len(joint_paths) == len(bind) == 40
    assert len(gltf["skins"]) == 1
    skin = gltf["skins"][0]
    assert len(skin["joints"]) == 40
    assert [gltf["nodes"][i]["extras"]["usdJointPath"] for i in skin["joints"]] == joint_paths

    source_parts = re.split(r'    def Mesh "([^"]+)"', source)[1:]
    source_meshes = dict(zip(source_parts[::2], source_parts[1::2]))
    all_points = [p for part in source_meshes.values() for p in source_array(part, "point3f[] points")]
    ymin = min(p[1] for p in all_points)
    ymax = max(p[1] for p in all_points)
    scale = 1.75 / (ymax - ymin)

    inverse_bind = read_accessor(skin["inverseBindMatrices"])
    for i, matrix in enumerate(bind):
        expected = [-matrix[3][0] * scale, -(matrix[3][1] - ymin) * scale, -matrix[3][2] * scale]
        actual = inverse_bind[i * 16 + 12 : i * 16 + 15]
        assert max(abs(a - b) for a, b in zip(actual, expected)) < 2e-6

    assert len(gltf["meshes"]) == 12
    assert sum(len(mesh["primitives"]) for mesh in gltf["meshes"]) == 14
    material_names = [material["name"] for material in gltf["materials"]]
    face_material = material_names.index("reference_face_cutout_CURVED_SKINNED_V2")
    shell_summary = None
    rest_y = []
    native_vertices = 0

    mesh_node_names = {
        gltf["meshes"][node["mesh"]]["name"]: node
        for node in gltf["nodes"]
        if "mesh" in node
    }
    assert set(mesh_node_names) == set(source_meshes)
    assert all(node.get("skin") == 0 for node in mesh_node_names.values())

    for mesh in gltf["meshes"]:
        name = mesh["name"]
        part = source_meshes[name]
        source_points = source_array(part, "point3f[] points")
        source_joints = source_array(part, "int[] primvars:skel:jointIndices")
        source_weights = source_array(part, "float[] primvars:skel:jointWeights")
        native = mesh["primitives"][0]
        attrs = native["attributes"]
        positions = read_accessor(attrs["POSITION"])
        joints = read_accessor(attrs["JOINTS_0"])
        weights = read_accessor(attrs["WEIGHTS_0"])
        expected_points = [head_morph(p) if name == "Body_hair" else p for p in source_points]
        expected_positions = [
            coordinate
            for x, y, z in expected_points
            for coordinate in (x * scale, (y - ymin) * scale, z * scale)
        ]
        assert len(positions) == len(expected_positions)
        assert max(abs(a - b) for a, b in zip(positions, expected_positions)) < 3e-7
        assert list(joints) == source_joints
        assert max(abs(a - b) for a, b in zip(weights, source_weights)) < 2e-7
        native_vertices += len(source_points)
        rest_y.extend(positions[1::3])

        for primitive in mesh["primitives"]:
            primitive_positions = read_accessor(primitive["attributes"]["POSITION"])
            indices = read_accessor(primitive["indices"])
            assert len(indices) % 3 == 0
            assert max(indices) < len(primitive_positions) // 3
            primitive_joints = read_accessor(primitive["attributes"]["JOINTS_0"])
            primitive_weights = read_accessor(primitive["attributes"]["WEIGHTS_0"])
            assert all(0 <= value < 40 for value in primitive_joints)
            assert all(
                abs(sum(primitive_weights[i : i + 4]) - 1.0) < 2e-5
                for i in range(0, len(primitive_weights), 4)
            )
            if primitive["material"] == face_material:
                assert name == "Body_skin"
                assert "TEXCOORD_0" in primitive["attributes"]
                shell_positions = primitive_positions
                shell_normals = read_accessor(primitive["attributes"]["NORMAL"])
                shell_uv = read_accessor(primitive["attributes"]["TEXCOORD_0"])
                shell_indices = indices
                xs = shell_positions[0::3]
                ys = shell_positions[1::3]
                zs = shell_positions[2::3]
                unique_joint_sets = {
                    tuple(primitive_joints[i : i + 4])
                    for i in range(0, len(primitive_joints), 4)
                }
                head_index = joint_paths.index("Hips/Spine/Chest/Neck/Head")
                jaw_index = joint_paths.index("Hips/Spine/Chest/Neck/Head/Jaw")
                assert all(row[:2] == (head_index, jaw_index) for row in unique_joint_sets)
                assert len(shell_positions) // 3 == 65 * 53
                assert len(shell_indices) // 3 == 64 * 52 * 2
                assert max(zs) - min(zs) > 0.075
                assert max(xs) - min(xs) > 0.18
                assert max(ys) - min(ys) > 0.24
                assert min(shell_uv) >= 0 and max(shell_uv) <= 1
                assert max(shell_normals[2::3]) > 0.75
                shell_summary = {
                    "vertices": len(shell_positions) // 3,
                    "triangles": len(shell_indices) // 3,
                    "x_span_m": max(xs) - min(xs),
                    "y_span_m": max(ys) - min(ys),
                    "z_span_m": max(zs) - min(zs),
                    "non_planar": True,
                    "joint_indices": [head_index, jaw_index],
                }
                rest_y.extend(ys)

    assert native_vertices == 28372
    assert shell_summary is not None
    assert abs(min(rest_y)) < 2e-7
    assert abs(max(rest_y) - 1.75) < 2e-7

    assert len(gltf.get("images", [])) == 1
    image = gltf["images"][0]
    assert image["mimeType"] == "image/png"
    view = gltf["bufferViews"][image["bufferView"]]
    embedded = binary[view.get("byteOffset", 0) : view.get("byteOffset", 0) + view["byteLength"]]
    assert sha256_bytes(embedded) == sha256_bytes(CUTOUT.read_bytes())
    material = gltf["materials"][face_material]
    assert material["alphaMode"] == "MASK"
    assert material["pbrMetallicRoughness"]["baseColorTexture"]["index"] == 0
    assert material["emissiveTexture"]["index"] == 0
    assert len(material["emissiveFactor"]) == 3
    assert not gltf.get("animations")

    result = {
        "schema": "NICOLAS_GAMEHOUSE_GLB_V2_INDEPENDENT_VALIDATION",
        "status": "PASS_STRUCTURE_RIG_CURVED_SHELL_AND_LOCAL_TEXTURE",
        "source_path": str(SOURCE),
        "source_sha256": sha256_bytes(SOURCE.read_bytes()),
        "glb_path": str(GLB),
        "glb_sha256": sha256_bytes(blob),
        "cutout_sha256": sha256_bytes(CUTOUT.read_bytes()),
        "joint_paths_preserved": 40,
        "source_meshes": 12,
        "gltf_skinned_primitives": 14,
        "native_vertices_compared": native_vertices,
        "native_weights_compared": True,
        "inverse_bind_rest_consistent": True,
        "rest_height_m": max(rest_y) - min(rest_y),
        "rest_floor_m": min(rest_y),
        "curved_face_shell": shell_summary,
        "billboard_or_plane": False,
        "embedded_animation_clips": 0,
        "recognition_test": "NOT_PROVEN_BY_NUMERIC_TEST__HUMAN_GATE_REQUIRED",
    }
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
