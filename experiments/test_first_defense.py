
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

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
OUTPUT_DIR = ROOT / "experiments" / "generated_tests" / "defense"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def normalize_image(image):
    # Candidate defense: automatic contrast adjustment
    return ImageOps.autocontrast(image, cutoff=1)


def main():
    train_good = load_images(DATA_DIR / "train" / "good")

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

    reference_features = extract_features(
        model, reference_paths
    )
    reference = reference_features.mean(axis=0)

    validation_features = extract_features(
        model, validation_paths
    )
    threshold = float(np.percentile(
        calculate_scores(validation_features, reference),
        95
    ))

    conditions = {
        "original": lambda x: x,
        "dark": lambda x: ImageEnhance.Brightness(x).enhance(0.55),
        "bright": lambda x: ImageEnhance.Brightness(x).enhance(1.4),
        "low_contrast": lambda x: ImageEnhance.Contrast(x).enhance(0.6),
        "high_contrast": lambda x: ImageEnhance.Contrast(x).enhance(1.4),
    }

    test_good = load_images(DATA_DIR / "test" / "good")

    defect_paths = []
    for folder in sorted((DATA_DIR / "test").iterdir()):
        if folder.is_dir() and folder.name != "good":
            defect_paths.extend(load_images(folder))

    image_paths = []
    metadata = []

    for label, sources in [(False, test_good), (True, defect_paths)]:
        for source in sources:
            with Image.open(source) as img:
                original = img.convert("RGB")

            for condition, transform in conditions.items():
                variant = transform(original)

                for defense_name, processed in [
                    ("baseline", variant),
                    ("normalized", normalize_image(variant)),
                ]:
                    filename = (
                        f"{source.parent.name}_{source.stem}_"
                        f"{condition}_{defense_name}.png"
                    )
                    path = OUTPUT_DIR / filename
                    processed.save(path)
                    image_paths.append(path)
                    metadata.append((label, condition, defense_name))

    print("Evaluating baseline and candidate defense...")
    features = extract_features(model, image_paths)
    scores = calculate_scores(features, reference)

    results = {}

    for (label, condition, defense_name), score in zip(metadata, scores):
        key = f"{condition}_{defense_name}"
        if key not in results:
            results[key] = {
                "normal": 0,
                "false_alarms": 0,
                "defective": 0,
                "detected_defects": 0,
            }

        group = results[key]
        predicted = bool(score > threshold)

        if label:
            group["defective"] += 1
            group["detected_defects"] += int(predicted)
        else:
            group["normal"] += 1
            group["false_alarms"] += int(predicted)

    print("\n========== FAULTFORGE DEFENSE TEST ==========")
    print(f"Threshold: {threshold:.4f}\n")

    for condition in conditions:
        print(f"\n{condition.upper()}")
        for defense_name in ["baseline", "normalized"]:
            r = results[f"{condition}_{defense_name}"]

            far = r["false_alarms"] / r["normal"]
            recall = r["detected_defects"] / r["defective"]

            print(
                f"  {defense_name:12} | "
                f"False alarms: {far:.1%} | "
                f"Defect recall: {recall:.1%}"
            )

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    output = RESULTS_DIR / "first_defense.json"

    with open(output, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved report: {output}")


if __name__ == "__main__":
    main()
