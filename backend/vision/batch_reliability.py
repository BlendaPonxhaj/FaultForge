
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

from backend.vision.meta_dinov2 import extract_meta_features
from backend.vision.reliability_test import DATA_DIR, get_inspector

ROOT = Path(__file__).resolve().parents[2]
RESULTS_DIR = ROOT / "experiments" / "results"

CONDITIONS = {
    "original": lambda img: img.copy(),
    "dark": lambda img: ImageEnhance.Brightness(img).enhance(0.55),
    "bright": lambda img: ImageEnhance.Brightness(img).enhance(1.4),
    "low_contrast": lambda img: ImageEnhance.Contrast(img).enhance(0.6),
    "high_contrast": lambda img: ImageEnhance.Contrast(img).enhance(1.4),
}


def run_batch_reliability():
    reference, threshold = get_inspector()

    test_dir = DATA_DIR / "test"

    paths = sorted(
        path for path in test_dir.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )

    if not paths:
        raise RuntimeError("No evaluation images found.")

    results = {
        condition: {
            "predictions": []
        }
        for condition in CONDITIONS
    }

    # Process small batches to reduce CPU/RAM pressure.
    batch_size = 4

    for start in range(0, len(paths), batch_size):
        batch_paths = paths[start:start + batch_size]

        images = []
        metadata = []

        for path in batch_paths:
            sample_id = path.relative_to(DATA_DIR).as_posix()
            category = path.parent.name
            actual_defect = category != "good"

            with Image.open(path) as img:
                original = img.convert("RGB")

            for condition_name, operation in CONDITIONS.items():
                images.append(operation(original))

                metadata.append({
                    "condition": condition_name,
                    "sample_id": sample_id,
                    "actual_defect": actual_defect,
                })

        embeddings = extract_meta_features(images)

        scores = np.linalg.norm(
            embeddings - reference,
            axis=1,
        )

        for info, score in zip(metadata, scores):
            predicted = bool(float(score) > threshold)

            results[info["condition"]]["predictions"].append({
                "sample_id": info["sample_id"],
                "actual_defect": info["actual_defect"],
                "predicted_defect": predicted,
                "anomaly_score": float(score),
            })

        print(
            f"Processed {min(start + batch_size, len(paths))}"
            f"/{len(paths)} images",
            flush=True,
        )

    for condition_name, condition_result in results.items():
        predictions = condition_result["predictions"]

        labels = np.array(
            [p["actual_defect"] for p in predictions],
            dtype=bool,
        )

        predicted = np.array(
            [p["predicted_defect"] for p in predictions],
            dtype=bool,
        )

        tp = int(np.sum(predicted & labels))
        tn = int(np.sum(~predicted & ~labels))
        fp = int(np.sum(predicted & ~labels))
        fn = int(np.sum(~predicted & labels))

        condition_result.update({
            "total_images": len(predictions),
            "true_positives": tp,
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn,
            "defect_recall": (
                tp / (tp + fn) if tp + fn else 0.0
            ),
            "false_alarm_rate": (
                fp / (fp + tn) if fp + tn else 0.0
            ),
        })

    report = {
        "model": "Meta DINOv2 ViT-S/14",
        "dataset": "MVTec AD - Bottle",
        "threshold": threshold,
        "conditions": results,
        "evaluation_type": "synthetic_batch_robustness",
        "independent_validation": False,
        "production_approved": False,
    }

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    output = RESULTS_DIR / "dinov2_batch_reliability.json"

    with output.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return report
