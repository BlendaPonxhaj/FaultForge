
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageEnhance

from backend.vision.reliability_test import (
    DATA_DIR,
    BASELINE_REPORT,
    DEVICE,
    get_inspector,
    transform,
)

ROOT = Path(__file__).resolve().parents[2]
RESULTS_DIR = ROOT / "experiments" / "results"

CONDITIONS = {
    "original": lambda img: img,
    "dark": lambda img: ImageEnhance.Brightness(img).enhance(0.55),
    "bright": lambda img: ImageEnhance.Brightness(img).enhance(1.4),
    "low_contrast": lambda img: ImageEnhance.Contrast(img).enhance(0.6),
    "high_contrast": lambda img: ImageEnhance.Contrast(img).enhance(1.4),
}


def run_batch_reliability():
    model, reference, threshold = get_inspector()

    with open(BASELINE_REPORT, encoding="utf-8") as f:
        baseline = json.load(f)

    samples = baseline["predictions"]

    results = {}

    for condition_name, operation in CONDITIONS.items():
        predictions = []
        scores = []
        labels = []
        sample_ids = []

        # Process images in batches to reduce memory use.
        for start in range(0, len(samples), 16):
            batch_samples = samples[start:start + 16]
            tensors = []

            for sample in batch_samples:
                sample_id = sample["sample_id"].replace("\\", "/")
                parts = sample_id.split("/")

                if (
                    len(parts) != 3
                    or parts[0] != "test"
                    or any(p in {"", ".", ".."} for p in parts)
                ):
                    raise ValueError(f"Invalid sample: {sample_id}")

                path = DATA_DIR.joinpath(*parts)

                with Image.open(path) as img:
                    image = operation(img.convert("RGB"))
                    tensors.append(transform(image))

                labels.append(bool(sample["actual_defect"]))
                sample_ids.append(sample_id)

            batch = torch.stack(tensors).to(DEVICE)

            with torch.inference_mode():
                features = model(batch).cpu().numpy()

            batch_scores = np.linalg.norm(
                features - reference,
                axis=1
            )

            scores.extend(float(x) for x in batch_scores)
            predictions.extend(
                bool(x > threshold) for x in batch_scores
            )

        labels_array = np.array(labels, dtype=bool)
        preds_array = np.array(predictions, dtype=bool)

        tp = int(np.sum(preds_array & labels_array))
        tn = int(np.sum(~preds_array & ~labels_array))
        fp = int(np.sum(preds_array & ~labels_array))
        fn = int(np.sum(~preds_array & labels_array))

        results[condition_name] = {
            "total_images": len(samples),
            "true_positives": tp,
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn,
            "defect_recall": tp / (tp + fn) if tp + fn else 0,
            "false_alarm_rate": fp / (fp + tn) if fp + tn else 0,
            "predictions": [
                {
                    "sample_id": sample_id,
                    "actual_defect": actual,
                    "predicted_defect": predicted,
                    "anomaly_score": score,
                }
                for sample_id, actual, predicted, score
                in zip(sample_ids, labels, predictions, scores)
            ],
        }

    report = {
        "model": "ResNet18 Global Baseline",
        "dataset": "MVTec AD - Bottle",
        "threshold": threshold,
        "conditions": results,
        "evaluation_type": "synthetic_batch_robustness",
        "independent_validation": False,
        "production_approved": False,
    }

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    output = RESULTS_DIR / "batch_reliability.json"

    with open(output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return report
