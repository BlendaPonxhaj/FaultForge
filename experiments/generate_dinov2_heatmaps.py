
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from backend.vision.meta_dinov2 import (
    get_meta_model,
    transform,
)
from backend.vision.reliability_test import DATA_DIR

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "experiments" / "results"
OUTPUT = RESULTS / "dinov2_heatmaps"

SEED = 42
BATCH_SIZE = 4
GRID_SIZE = 16


def load_images(folder):
    return sorted(
        p for p in folder.rglob("*")
        if p.is_file()
        and p.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )


@torch.inference_mode()
def extract_patches(paths, model):
    result = []

    for start in range(0, len(paths), BATCH_SIZE):
        batch_paths = paths[start:start + BATCH_SIZE]
        images = []

        for path in batch_paths:
            with Image.open(path) as img:
                images.append(transform(img.convert("RGB")))

        batch = torch.stack(images)

        features = model.forward_features(batch)
        patches = features["x_norm_patchtokens"]

        result.append(patches.cpu().numpy())

    return np.concatenate(result, axis=0)


def save_heatmap(image_path, scores, output_path):
    grid = scores.reshape(GRID_SIZE, GRID_SIZE)

    minimum = float(grid.min())
    maximum = float(grid.max())

    if maximum > minimum:
        normalized = (grid - minimum) / (maximum - minimum)
    else:
        normalized = np.zeros_like(grid)

    with Image.open(image_path) as img:
        original = img.convert("RGB")

    resized = Image.fromarray(
        (normalized * 255).astype(np.uint8)
    ).resize(
        original.size,
        Image.Resampling.BILINEAR,
    )

    intensity = np.asarray(resized, dtype=np.float32) / 255.0

    red = Image.new("RGB", original.size, (255, 30, 30))
    alpha = Image.fromarray(
        (intensity * 185).astype(np.uint8)
    )

    overlay = original.copy()
    overlay.paste(red, (0, 0), alpha)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    overlay.save(output_path)

    return {
        "minimum_patch_score": minimum,
        "maximum_patch_score": maximum,
    }


def main():
    model = get_meta_model()

    train_good = load_images(DATA_DIR / "train" / "good")

    if len(train_good) < 10:
        raise RuntimeError("Not enough normal training images.")

    rng = np.random.default_rng(SEED)
    shuffled = rng.permutation(len(train_good))
    validation_count = max(1, int(len(train_good) * 0.2))

    reference_paths = [
        train_good[i]
        for i in shuffled[validation_count:]
    ]

    print("Extracting normal DINOv2 patch embeddings...", flush=True)

    reference_features = extract_patches(reference_paths, model)

    if reference_features.shape[1:] != (256, 384):
        raise RuntimeError(
            f"Unexpected patch shape: {reference_features.shape}"
        )

    reference = reference_features.mean(axis=0)

    evaluation = json.loads(
        (RESULTS / "dinov2_evaluation.json").read_text(
            encoding="utf-8"
        )
    )

    if evaluation["model"] != "Meta DINOv2 ViT-S/14":
        raise RuntimeError("Unexpected evaluation model.")

    paths = [
        DATA_DIR.joinpath(*item["sample_id"].split("/"))
        for item in evaluation["predictions"]
    ]

    if not all(path.is_file() for path in paths):
        raise RuntimeError("Some evaluation images are missing.")

    print(f"Generating {len(paths)} heatmaps...", flush=True)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = []

    for start in range(0, len(paths), BATCH_SIZE):
        batch_paths = paths[start:start + BATCH_SIZE]
        patches = extract_patches(batch_paths, model)

        distances = np.linalg.norm(
            patches - reference[None, :, :],
            axis=2,
        )

        for path, scores in zip(batch_paths, distances):
            sample_id = path.relative_to(DATA_DIR).as_posix()
            output_path = OUTPUT.joinpath(*sample_id.split("/"))

            stats = save_heatmap(path, scores, output_path)

            manifest.append({
                "sample_id": sample_id,
                "heatmap": sample_id,
                **stats,
            })

        print(
            f"Processed {min(start + BATCH_SIZE, len(paths))}"
            f"/{len(paths)}",
            flush=True,
        )

    manifest_path = OUTPUT / "manifest.json"
    manifest_path.write_text(
        json.dumps({
            "model": "Meta DINOv2 ViT-S/14",
            "visualization": "per-image relative patch anomaly map",
            "reference_count": len(reference_paths),
            "total": len(manifest),
            "images": manifest,
            "independent_validation": False,
        }, indent=2),
        encoding="utf-8",
    )

    print("Generated:", len(manifest), "heatmaps")
    print("Saved to:", OUTPUT)
    print("Note: Heatmaps are not validated segmentation masks.")


if __name__ == "__main__":
    main()
