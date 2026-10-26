
import json
from pathlib import Path

import numpy as np

from run_real_baseline import (
    DATA_DIR,
    RESULTS_DIR,
    RANDOM_SEED,
    load_images,
    create_model,
    extract_features,
    calculate_scores,
)

ROOT = Path(__file__).resolve().parents[1]
GENERATED_DIR = ROOT / "experiments" / "generated_tests"

def main():
    # Same reference split as the original baseline
    train_good = load_images(DATA_DIR / "train" / "good")

    rng = np.random.default_rng(RANDOM_SEED)
    shuffled = rng.permutation(len(train_good))

    validation_count = max(1, int(len(train_good) * 0.2))

    validation_paths = [
        train_good[i] for i in shuffled[:validation_count]
    ]

    reference_paths = [
        train_good[i] for i in shuffled[validation_count:]
    ]

    model = create_model()

    print("Rebuilding original baseline reference...")

    reference_features = extract_features(
        model, reference_paths
    )
    reference = reference_features.mean(axis=0)

    validation_features = extract_features(
        model, validation_paths
    )
    validation_scores = calculate_scores(
        validation_features, reference
    )

    threshold = float(
        np.percentile(validation_scores, 95)
    )

    original = DATA_DIR / "test" / "broken_small" / "007.png"

    variants = [
        ("original", original),
        ("dark", GENERATED_DIR / "007_dark.png"),
        ("bright", GENERATED_DIR / "007_bright.png"),
        ("low_contrast", GENERATED_DIR / "007_low_contrast.png"),
        ("high_contrast", GENERATED_DIR / "007_high_contrast.png"),
    ]

    paths = [path for _, path in variants]

    for path in paths:
        if not path.exists():
            raise FileNotFoundError(f"Missing image: {path}")

    features = extract_features(model, paths)
    scores = calculate_scores(features, reference)

    results = []

    print("\n========== FAULTFORGE RED AGENT EVALUATION ==========")
    print(f"Threshold: {threshold:.4f}\n")

    for (name, path), score in zip(variants, scores):
        score = float(score)
        detected = score > threshold

        result = {
            "test": name,
            "image": str(path),
            "anomaly_score": score,
            "predicted_defect": bool(detected)
        }
        results.append(result)

        status = "DETECTED" if detected else "MISSED"

        print(
            f"{name:15} | Score: {score:.4f} "
            f"| {status}"
        )

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    output = RESULTS_DIR / "red_agent_evaluation.json"

    with open(output, "w", encoding="utf-8") as f:
        json.dump({
            "threshold": threshold,
            "results": results
        }, f, indent=2)

    print(f"\nSaved report: {output}")


if __name__ == "__main__":
    main()
