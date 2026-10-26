
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from run_real_baseline import (
    DATA_DIR,
    RESULTS_DIR,
    RANDOM_SEED,
    DEVICE,
    load_images,
    create_model,
)

from run_patch_baseline import (
    GRID_SIZE,
    extract_patch_features,
)

OUTPUT_DIR = RESULTS_DIR / "heatmaps"


def create_heatmap(patches, reference, image_path, output_path):
    # Same spatial anomaly distances used by our patch model
    distances = np.linalg.norm(
        patches - reference,
        axis=1
    ).reshape(GRID_SIZE, GRID_SIZE)

    minimum = float(distances.min())
    maximum = float(distances.max())

    # Relative heatmap for visualization.
    # Each image is scaled separately.
    if maximum > minimum:
        normalized = (distances - minimum) / (maximum - minimum)
    else:
        normalized = np.zeros_like(distances)

    with Image.open(image_path) as img:
        original = img.convert("RGB")

    heatmap = Image.fromarray(
        (normalized * 255).astype(np.uint8)
    ).resize(
        original.size,
        Image.Resampling.BILINEAR
    )

    intensity = np.asarray(heatmap, dtype=np.float32) / 255.0

    # Create a red overlay.
    red_overlay = Image.new("RGB", original.size, (255, 30, 30))

    opacity = Image.fromarray(
        (intensity * 185).astype(np.uint8)
    )

    result = original.copy()
    result.paste(red_overlay, (0, 0), opacity)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path)

    return {
        "minimum_patch_score": minimum,
        "maximum_patch_score": maximum
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    report_path = RESULTS_DIR / "patch_baseline.json"

    with open(report_path, "r", encoding="utf-8") as f:
        report = json.load(f)

    sample_ids = [
        item["sample_id"].replace("\\", "/")
        for item in report["predictions"]
    ]

    # Reproduce the original reference split exactly.
    train_good = load_images(DATA_DIR / "train" / "good")

    rng = np.random.default_rng(RANDOM_SEED)
    shuffled = rng.permutation(len(train_good))

    validation_count = max(
        1,
        int(len(train_good) * 0.2)
    )

    reference_paths = [
        train_good[i]
        for i in shuffled[validation_count:]
    ]

    print("Loading ResNet18 spatial model...", flush=True)

    full_model = create_model()

    patch_model = torch.nn.Sequential(
        *list(full_model.children())[:6]
    ).to(DEVICE)

    patch_model.eval()

    print("Building normal patch reference...", flush=True)

    reference_features = extract_patch_features(
        patch_model,
        reference_paths
    )

    reference = reference_features.mean(axis=0)

    image_paths = [
        DATA_DIR / Path(*sample_id.split("/"))
        for sample_id in sample_ids
    ]

    for image_path in image_paths:
        if not image_path.is_file():
            raise FileNotFoundError(image_path)

    print(
        f"Extracting features for {len(image_paths)} images...",
        flush=True
    )

    # Batch extraction is faster than processing one image at a time.
    all_features = extract_patch_features(
        patch_model,
        image_paths
    )

    manifest = []

    print("Generating anomaly heatmaps...", flush=True)

    for index, (sample_id, image_path) in enumerate(
        zip(sample_ids, image_paths),
        start=1
    ):
        output_path = OUTPUT_DIR / Path(*sample_id.split("/"))

        stats = create_heatmap(
            all_features[index - 1],
            reference,
            image_path,
            output_path
        )

        manifest.append({
            "sample_id": sample_id,
            "heatmap": sample_id,
            **stats
        })

        print(
            f"[{index}/{len(sample_ids)}] {sample_id}",
            flush=True
        )

    manifest_path = OUTPUT_DIR / "manifest.json"

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "model": "ResNet18 Spatial Patch Baseline",
                "visualization": "per-image relative anomaly heatmap",
                "total": len(manifest),
                "images": manifest
            },
            f,
            indent=2
        )

    print("\n========== FAULTFORGE HEATMAPS ==========")
    print(f"Generated: {len(manifest)} heatmaps")
    print(f"Saved to: {OUTPUT_DIR}")
    print(f"Manifest: {manifest_path}")
    print(
        "Note: Heatmaps show relative anomaly intensity, "
        "not validated defect segmentation."
    )


if __name__ == "__main__":
    main()
