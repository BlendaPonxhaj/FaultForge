
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from sklearn.metrics import roc_auc_score

from run_real_baseline import (
    DATA_DIR,
    RESULTS_DIR,
    RANDOM_SEED,
    BATCH_SIZE,
    DEVICE,
    transform,
    load_images,
    create_model,
)

# Local feature grid: 7 x 7 = 49 regions
GRID_SIZE = 7
TOP_K = 3


@torch.no_grad()
def extract_patch_features(model, paths):
    features = []

    for start in range(0, len(paths), BATCH_SIZE):
        batch_paths = paths[start:start + BATCH_SIZE]

        images = []
        for path in batch_paths:
            with Image.open(path) as img:
                images.append(transform(img.convert("RGB")))

        batch = torch.stack(images).to(DEVICE)

        # ResNet18 until layer2: spatial features
        feature_map = model(batch)

        # Convert to a 7x7 grid
        feature_map = F.adaptive_avg_pool2d(
            feature_map, (GRID_SIZE, GRID_SIZE)
        )

        # Shape: [batch, 49, channels]
        patches = feature_map.flatten(2).transpose(1, 2)

        features.append(patches.cpu().numpy())

    return np.concatenate(features, axis=0)


def calculate_patch_scores(features, normal_reference):
    # Compare each image region with its corresponding
    # normal reference region.
    distances = np.linalg.norm(
        features - normal_reference[None, :, :],
        axis=2
    )

    # A few highly anomalous regions determine the score.
    highest = np.sort(distances, axis=1)[:, -TOP_K:]
    return highest.mean(axis=1)


def main():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    train_good = load_images(DATA_DIR / "train" / "good")
    test_good = load_images(DATA_DIR / "test" / "good")

    defect_paths = []
    for folder in sorted((DATA_DIR / "test").iterdir()):
        if folder.is_dir() and folder.name != "good":
            defect_paths.extend(load_images(folder))

    if len(train_good) < 10 or not test_good or not defect_paths:
        raise ValueError("Dataset images are missing.")

    rng = np.random.default_rng(RANDOM_SEED)
    shuffled = rng.permutation(len(train_good))

    validation_count = max(1, int(len(train_good) * 0.2))

    validation_paths = [
        train_good[i] for i in shuffled[:validation_count]
    ]
    reference_paths = [
        train_good[i] for i in shuffled[validation_count:]
    ]

    print("Loading ResNet18 spatial feature extractor...")
    full_model = create_model()

    # conv1, bn1, relu, maxpool, layer1, layer2
    patch_model = torch.nn.Sequential(
        *list(full_model.children())[:6]
    ).to(DEVICE)
    patch_model.eval()

    print("Extracting normal reference patches...", flush=True)
    reference_features = extract_patch_features(
        patch_model, reference_paths
    )

    # Average normal features at each grid position
    normal_reference = reference_features.mean(axis=0)

    print("Calibrating threshold on normal images...", flush=True)
    validation_features = extract_patch_features(
        patch_model, validation_paths
    )
    validation_scores = calculate_patch_scores(
        validation_features, normal_reference
    )

    threshold = float(np.percentile(validation_scores, 95))

    print("Evaluating test images...", flush=True)
    test_paths = test_good + defect_paths

    labels = np.array(
        [0] * len(test_good) + [1] * len(defect_paths)
    )

    features = extract_patch_features(patch_model, test_paths)
    scores = calculate_patch_scores(features, normal_reference)
    predictions = (scores > threshold).astype(int)

    tp = int(np.sum((labels == 1) & (predictions == 1)))
    tn = int(np.sum((labels == 0) & (predictions == 0)))
    fp = int(np.sum((labels == 0) & (predictions == 1)))
    fn = int(np.sum((labels == 1) & (predictions == 0)))

    recall = tp / (tp + fn)
    far = fp / (fp + tn)
    auc = float(roc_auc_score(labels, scores))

    results = {
        "model": "ResNet18 Spatial Patch Baseline",
        "dataset": "MVTec AD - Bottle",
        "grid_size": GRID_SIZE,
        "top_k": TOP_K,
        "threshold": threshold,
        "test_images": len(test_paths),
        "true_positives": tp,
        "true_negatives": tn,
        "false_positives": fp,
        "false_negatives": fn,
        "defect_recall": recall,
        "false_alarm_rate": far,
        "roc_auc": auc,
        "predictions": [
            {
                "sample_id": str(path.relative_to(DATA_DIR)),
                "actual_defect": bool(label),
                "predicted_defect": bool(pred),
                "anomaly_score": float(score)
            }
            for path, label, pred, score in zip(
                test_paths, labels, predictions, scores
            )
        ]
    }

    output = RESULTS_DIR / "patch_baseline.json"

    with open(output, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n========== FAULTFORGE PATCH BASELINE ==========")
    print(f"Threshold: {threshold:.4f}")
    print(f"Defect recall: {recall:.2%}")
    print(f"False alarm rate: {far:.2%}")
    print(f"ROC-AUC: {auc:.4f}")
    print(f"Missed defects: {fn}")
    print(f"False alarms: {fp}")
    print(f"\nSaved report: {output}")


if __name__ == "__main__":
    main()
