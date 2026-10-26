
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

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
CACHE_DIR = ROOT / "experiments" / "generated_tests" / "calibrated"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def preprocess(paths, group):
    output_dir = CACHE_DIR / group
    output_dir.mkdir(parents=True, exist_ok=True)

    processed = []

    for i, source in enumerate(paths):
        destination = output_dir / f"{i:05d}.png"

        with Image.open(source) as img:
            image = ImageOps.autocontrast(
                img.convert("RGB"),
                cutoff=1
            )
            image.save(destination)

        processed.append(destination)

    return processed


def evaluate_pipeline(model, reference_paths, validation_paths,
                      good_paths, defective_paths, use_normalization):

    if use_normalization:
        name = "normalized"
        reference_paths = preprocess(reference_paths, name + "_reference")
        validation_paths = preprocess(validation_paths, name + "_validation")
        good_paths = preprocess(good_paths, name + "_good")
        defective_paths = preprocess(defective_paths, name + "_defective")
    else:
        name = "baseline"

    reference_features = extract_features(model, reference_paths)
    reference = reference_features.mean(axis=0)

    validation_features = extract_features(model, validation_paths)
    threshold = float(np.percentile(
        calculate_scores(validation_features, reference), 95
    ))

    test_paths = good_paths + defective_paths
    features = extract_features(model, test_paths)
    scores = calculate_scores(features, reference)
    predictions = scores > threshold

    labels = np.array(
        [False] * len(good_paths) +
        [True] * len(defective_paths)
    )

    tp = int(np.sum(predictions & labels))
    tn = int(np.sum(~predictions & ~labels))
    fp = int(np.sum(predictions & ~labels))
    fn = int(np.sum(~predictions & labels))

    return {
        "pipeline": name,
        "threshold": threshold,
        "true_positives": tp,
        "true_negatives": tn,
        "false_positives": fp,
        "false_negatives": fn,
        "defect_recall": tp / (tp + fn),
        "false_alarm_rate": fp / (fp + tn)
    }


def main():
    train_good = load_images(DATA_DIR / "train" / "good")
    test_good = load_images(DATA_DIR / "test" / "good")

    test_defective = []
    for folder in sorted((DATA_DIR / "test").iterdir()):
        if folder.is_dir() and folder.name != "good":
            test_defective.extend(load_images(folder))

    rng = np.random.default_rng(RANDOM_SEED)
    shuffled = rng.permutation(len(train_good))
    count = max(1, int(len(train_good) * 0.2))

    reference_paths = [
        train_good[i] for i in shuffled[count:]
    ]
    validation_paths = [
        train_good[i] for i in shuffled[:count]
    ]

    model = create_model()

    baseline = evaluate_pipeline(
        model, reference_paths, validation_paths,
        test_good, test_defective, False
    )

    normalized = evaluate_pipeline(
        model, reference_paths, validation_paths,
        test_good, test_defective, True
    )

    print("\n===== CALIBRATED DEFENSE COMPARISON =====")

    for result in [baseline, normalized]:
        print(f"\n{result['pipeline'].upper()}")
        print(f"Threshold: {result['threshold']:.4f}")
        print(f"Defect recall: {result['defect_recall']:.2%}")
        print(f"False alarm rate: {result['false_alarm_rate']:.2%}")
        print(f"Missed defects: {result['false_negatives']}")
        print(f"False alarms: {result['false_positives']}")

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output = RESULTS_DIR / "calibrated_defense.json"

    with open(output, "w", encoding="utf-8") as f:
        json.dump(
            {"baseline": baseline, "normalized": normalized},
            f,
            indent=2
        )

    print(f"\nSaved: {output}")


if __name__ == "__main__":
    main()
