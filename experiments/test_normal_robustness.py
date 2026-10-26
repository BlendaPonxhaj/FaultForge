
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

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

OUTPUT_DIR = ROOT / "experiments" / "generated_tests" / "normal"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def generate_variants(image_path):
    variants = []

    with Image.open(image_path) as img:
        image = img.convert("RGB")

    operations = {
        "original": lambda x: x,
        "dark": lambda x: ImageEnhance.Brightness(x).enhance(0.55),
        "bright": lambda x: ImageEnhance.Brightness(x).enhance(1.4),
        "low_contrast": lambda x: ImageEnhance.Contrast(x).enhance(0.6),
        "high_contrast": lambda x: ImageEnhance.Contrast(x).enhance(1.4),
    }

    for name, operation in operations.items():
        output_path = OUTPUT_DIR / f"{image_path.stem}_{name}.png"

        operation(image).save(output_path)
        variants.append((name, output_path))

    return variants


def main():
    train_good = load_images(DATA_DIR / "train" / "good")
    test_good = load_images(DATA_DIR / "test" / "good")

    rng = np.random.default_rng(RANDOM_SEED)
    shuffled = rng.permutation(len(train_good))

    validation_count = max(1, int(len(train_good) * 0.2))

    reference_paths = [
        train_good[i] for i in shuffled[validation_count:]
    ]

    validation_paths = [
        train_good[i] for i in shuffled[:validation_count]
    ]

    model = create_model()

    reference_features = extract_features(model, reference_paths)
    reference = reference_features.mean(axis=0)

    validation_features = extract_features(model, validation_paths)
    validation_scores = calculate_scores(validation_features, reference)

    threshold = float(np.percentile(validation_scores, 95))

    all_variants = []

    for path in test_good:
        all_variants.extend(generate_variants(path))

    paths = [path for _, path in all_variants]

    features = extract_features(model, paths)
    scores = calculate_scores(features, reference)

    results = {}

    for (name, path), score in zip(all_variants, scores):
        results.setdefault(name, {
            "total": 0,
            "false_alarms": 0
        })

        results[name]["total"] += 1

        if score > threshold:
            results[name]["false_alarms"] += 1

    print("\n===== NORMAL IMAGE ROBUSTNESS =====")
    print(f"Threshold: {threshold:.4f}\n")

    for name, data in results.items():
        rate = data["false_alarms"] / data["total"]

        data["false_alarm_rate"] = rate

        print(
            f"{name:15} | "
            f"False alarms: {data['false_alarms']:2}/{data['total']} "
            f"| Rate: {rate:.2%}"
        )

    output = RESULTS_DIR / "normal_robustness.json"

    with open(output, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved: {output}")


if __name__ == "__main__":
    main()
