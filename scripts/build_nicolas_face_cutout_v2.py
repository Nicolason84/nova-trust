#!/usr/bin/env python3
"""Build the local Nicolas face cutout used by the curved skinned shell.

The source portrait never leaves the machine. Apple Vision landmarks were captured
once into the proof JSON; this script only performs deterministic crop/mask/edge
bleed so texture filtering cannot reveal a pale background halo.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
PROOF = ROOT / "PROOF/NICOLAS_GAMEHOUSE_V1_20261005/avatar-v2"
SOURCE = Path(
    "/Users/nicolasalonso/Pictures/Photos Library.photoslibrary/resources/derivatives/"
    "E/E95D2A13-C567-4D41-860A-E27FD67D37E2_1_105_c.jpeg"
)
LANDMARKS = PROOF / "FACE_LANDMARKS.json"
OUTPUT = PROOF / "nicolas-face-cutout-v2.png"
MANIFEST = PROOF / "FACE_CUTOUT_MANIFEST.json"
CROP = (239, 35, 480, 401)
HAIR_ARC = [
    (255, 220), (257, 170), (268, 118), (286, 76), (313, 49),
    (351, 38), (391, 43), (423, 65), (447, 105), (461, 157), (465, 220),
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    source = Image.open(SOURCE).convert("RGB")
    data = json.loads(LANDMARKS.read_text())
    contour = data["faces"][0]["faceContour"]

    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).polygon(
        [(round(x), round(y)) for x, y in HAIR_ARC + contour], fill=255
    )
    mask = mask.filter(ImageFilter.GaussianBlur(1.65))

    rgb = np.asarray(source, dtype=np.uint8)
    alpha = np.asarray(mask, dtype=np.uint8)
    foreground = alpha >= 128
    # Copy the nearest foreground colour beneath every transparent texel. Alpha
    # remains unchanged; this only prevents bilinear sampling from creating halos.
    _, nearest = ndimage.distance_transform_edt(~foreground, return_indices=True)
    bled = rgb[nearest[0], nearest[1]].copy()
    bled[foreground] = rgb[foreground]
    rgba = np.dstack([bled, alpha])

    result = Image.fromarray(rgba).convert("RGBA").crop(CROP)
    result.save(OUTPUT, optimize=True)
    manifest = {
        "schema": "NICOLAS_LOCAL_FACE_CUTOUT_V2",
        "source_path": str(SOURCE),
        "source_sha256": sha256(SOURCE),
        "landmarks_path": str(LANDMARKS),
        "landmarks_sha256": sha256(LANDMARKS),
        "output_path": str(OUTPUT),
        "output_sha256": sha256(OUTPUT),
        "crop": list(CROP),
        "size": list(result.size),
        "method": "APPLE_VISION_LANDMARKS_PLUS_LOCAL_POLYGON_MASK_NEAREST_RGB_EDGE_BLEED",
        "external_upload": False,
        "likeness_status": "REQUIRES_HUMAN_VISUAL_APPROVAL",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
