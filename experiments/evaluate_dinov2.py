
import argparse
import json
from pathlib import Path

from backend.vision.reliability_test import (
    DATA_DIR,
    run_reliability_test,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "experiments" / "results" / "dinov2_evaluation.json"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()

    paths = sorted(
        p for p in (DATA_DIR / "test").rglob("*")
        if p.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )

    if not paths:
        raise RuntimeError("No test images found.")

    if args.limit > 0:
        paths = paths[:args.limit]

    tp = tn = fp = fn = 0
    changed = 0
    predictions = []

    for i, path in enumerate(paths, 1):
        sample_id = path.relative_to(DATA_DIR).as_posix()
        result = run_reliability_test(sample_id)

        original = result["tests"][0]
        actual = result["actual_defect"]
        predicted = original["predicted_defect"]

        if actual and predicted:
            tp += 1
        elif not actual and not predicted:
            tn += 1
        elif not actual and predicted:
            fp += 1
        else:
            fn += 1

        changed += result["changed_predictions"]

        predictions.append({
            "sample_id": sample_id,
            "actual_defect": actual,
            "predicted_defect": predicted,
            "anomaly_score": original["anomaly_score"],
            "changed_predictions": result["changed_predictions"],
        })

        print(f"[{i}/{len(paths)}] {sample_id}: "
              f"{'CORRECT' if actual == predicted else 'WRONG'}",
              flush=True)

    total = tp + tn + fp + fn
    accuracy = (tp + tn) / total
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall else 0.0
    )

    report = {
        "model": "Meta DINOv2 ViT-S/14",
        "evaluated_images": total,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "confusion_matrix": {
            "TP": tp, "TN": tn, "FP": fp, "FN": fn,
        },
        "prediction_changes": changed,
        "total_transformations": total * 4,
        "predictions": predictions,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )

    print("\n=== DINOv2 EVALUATION ===")
    print("Images:", total)
    print("Accuracy:", round(accuracy, 4))
    print("Precision:", round(precision, 4))
    print("Recall:", round(recall, 4))
    print("F1:", round(f1, 4))
    print("TP / TN / FP / FN:", tp, tn, fp, fn)
    print("Prediction changes:", changed)


if __name__ == "__main__":
    main()
