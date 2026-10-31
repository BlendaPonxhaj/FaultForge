
import json
from pathlib import Path

import numpy as np

from backend.vision.meta_dinov2 import extract_meta_features

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "experiments" / "data" / "mvtec" / "bottle"
OUTPUT = ROOT / "experiments" / "results" / "dinov2_calibration.json"

SEED = 42


def load_images(folder):
    return sorted(
        p for p in folder.rglob("*")
        if p.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )


def main():
    train_good = load_images(DATA_DIR / "train" / "good")

    if len(train_good) < 10:
        raise RuntimeError("Not enough normal training images.")

    rng = np.random.default_rng(SEED)
    shuffled = rng.permutation(len(train_good))

    count = max(1, int(len(train_good) * 0.2))

    validation_paths = [train_good[i] for i in shuffled[:count]]
    reference_paths = [train_good[i] for i in shuffled[count:]]

    def extract(paths):
        features = []
        for i in range(0, len(paths), 8):
            images = []
            for path in paths[i:i + 8]:
                from PIL import Image
                with Image.open(path) as img:
                    images.append(img.convert("RGB"))
            features.append(extract_meta_features(images))
        return np.concatenate(features, axis=0)

    reference_features = extract(reference_paths)
    reference = reference_features.mean(axis=0)

    validation_features = extract(validation_paths)

    scores = np.linalg.norm(validation_features - reference, axis=1)
    threshold = float(np.percentile(scores, 95))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump({
            "model": "Meta DINOv2 ViT-S/14",
            "model_id": "dinov2_vits14",
            "dataset": "MVTec AD Bottle",
            "seed": SEED,
            "reference_count": len(reference_paths),
            "validation_count": len(validation_paths),
            "threshold": threshold,
            "reference_embedding": reference.tolist(),
            "evaluation_type": "normal_only_calibration"
        }, f, indent=2)

    print("Meta DINOv2 calibration completed!")
    print("Reference images:", len(reference_paths))
    print("Validation images:", len(validation_paths))
    print("Threshold:", threshold)


if __name__ == "__main__":
    main()
