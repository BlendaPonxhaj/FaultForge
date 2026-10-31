
import json
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

from backend.vision.meta_dinov2 import extract_meta_features

ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = ROOT / "experiments" / "data" / "mvtec" / "bottle"

CALIBRATION_FILE = (
    ROOT / "experiments" / "results" / "dinov2_calibration.json"
)


@lru_cache(maxsize=1)
def get_inspector():
    """Load the calibrated Meta DINOv2 reference."""
    with open(CALIBRATION_FILE, encoding="utf-8") as f:
        calibration = json.load(f)

    if calibration["model_id"] != "dinov2_vits14":
        raise RuntimeError("Unexpected calibration model.")

    reference = np.asarray(
        calibration["reference_embedding"],
        dtype=np.float32,
    )

    threshold = float(calibration["threshold"])

    if reference.shape != (384,):
        raise RuntimeError("Invalid DINOv2 reference embedding.")

    if not np.isfinite(threshold):
        raise RuntimeError("Invalid calibration threshold.")

    return reference, threshold


def run_reliability_test(sample_id: str):
    sample_id = sample_id.replace("\\", "/")
    parts = sample_id.split("/")

    if (
        len(parts) != 3
        or parts[0] != "test"
        or any(part in {"", ".", ".."} for part in parts)
    ):
        raise ValueError("Invalid inspection sample path.")

    image_path = DATA_DIR.joinpath(*parts)

    if (
        not image_path.is_file()
        or image_path.suffix.lower() not in {".png", ".jpg", ".jpeg"}
    ):
        raise FileNotFoundError(sample_id)

    reference, threshold = get_inspector()

    with Image.open(image_path) as img:
        original = img.convert("RGB")

    variants = [
        ("original", original),
        (
            "dark",
            ImageEnhance.Brightness(original).enhance(0.55),
        ),
        (
            "bright",
            ImageEnhance.Brightness(original).enhance(1.4),
        ),
        (
            "low_contrast",
            ImageEnhance.Contrast(original).enhance(0.6),
        ),
        (
            "high_contrast",
            ImageEnhance.Contrast(original).enhance(1.4),
        ),
    ]

    embeddings = extract_meta_features(
        [image for _, image in variants]
    )

    scores = np.linalg.norm(
        embeddings - reference,
        axis=1,
    )

    # MVTec AD: test/good contains normal images.
    actual_defect = parts[1] != "good"

    results = []

    for (condition, _), score in zip(variants, scores):
        anomaly_score = float(score)
        detected = anomaly_score > threshold

        results.append({
            "condition": condition,
            "anomaly_score": anomaly_score,
            "predicted_defect": bool(detected),
            "correct": bool(detected == actual_defect),
        })

    original_prediction = results[0]["predicted_defect"]

    changed_predictions = sum(
        result["predicted_defect"] != original_prediction
        for result in results[1:]
    )

    return {
        "sample_id": sample_id,
        "model": "Meta DINOv2 ViT-S/14",
        "actual_defect": actual_defect,
        "threshold": threshold,
        "tests": results,
        "changed_predictions": changed_predictions,
        "total_transformations": 4,
        "evaluation_type": "synthetic_robustness",
        "independent_validation": False,
        "note": (
            "Meta DINOv2 global embeddings with a calibrated "
            "normal-reference threshold. Synthetic robustness "
            "tests do not establish independent validation."
        ),
    }
