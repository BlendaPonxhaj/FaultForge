
import json
from functools import lru_cache
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageEnhance
from torchvision import models, transforms

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "experiments" / "data" / "mvtec" / "bottle"
BASELINE_REPORT = ROOT / "experiments" / "results" / "bottle_baseline.json"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SEED = 42

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


def load_images(folder: Path):
    return sorted(
        path for path in folder.rglob("*")
        if path.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )


@torch.inference_mode()
def extract_features(model, paths):
    batches = []

    for start in range(0, len(paths), 16):
        images = []

        for path in paths[start:start + 16]:
            with Image.open(path) as img:
                images.append(transform(img.convert("RGB")))

        tensor = torch.stack(images).to(DEVICE)
        batches.append(model(tensor).cpu().numpy())

    return np.concatenate(batches, axis=0)


@lru_cache(maxsize=1)
def get_inspector():
    """
    Reconstructs the frozen global baseline using
    the same normal training split and calibration.
    Cached for subsequent API calls.
    """
    train_good = load_images(DATA_DIR / "train" / "good")

    if len(train_good) < 10:
        raise RuntimeError("Normal training images are missing.")

    rng = np.random.default_rng(SEED)
    shuffled = rng.permutation(len(train_good))
    count = max(1, int(len(train_good) * 0.2))

    validation_paths = [
        train_good[i] for i in shuffled[:count]
    ]
    reference_paths = [
        train_good[i] for i in shuffled[count:]
    ]

    model = models.resnet18(
        weights=models.ResNet18_Weights.DEFAULT
    )
    model.fc = torch.nn.Identity()
    model = model.to(DEVICE).eval()

    reference_features = extract_features(
        model, reference_paths
    )
    reference = reference_features.mean(axis=0)

    validation_features = extract_features(
        model, validation_paths
    )

    validation_scores = np.linalg.norm(
        validation_features - reference,
        axis=1
    )

    threshold = float(np.percentile(validation_scores, 95))

    # Verify that this is the same baseline as the saved report.
    with open(BASELINE_REPORT, encoding="utf-8") as f:
        saved = json.load(f)

    saved_threshold = float(saved["threshold"])

    if not np.isclose(threshold, saved_threshold, atol=1e-3):
        raise RuntimeError(
            "Baseline calibration differs from saved report. "
            "Check dataset and model configuration."
        )

    return model, reference, threshold


def run_reliability_test(sample_id: str):
    with open(BASELINE_REPORT, encoding="utf-8") as f:
        baseline = json.load(f)

    known_samples = {
        item["sample_id"].replace("\\", "/"): item
        for item in baseline["predictions"]
    }

    if sample_id not in known_samples:
        raise ValueError("Unknown inspection sample.")

    parts = sample_id.split("/")

    if (
        len(parts) != 3
        or parts[0] != "test"
        or any(part in {"", ".", ".."} for part in parts)
    ):
        raise ValueError("Invalid inspection sample path.")

    image_path = DATA_DIR.joinpath(*parts)

    if not image_path.is_file():
        raise FileNotFoundError(sample_id)

    model, reference, threshold = get_inspector()

    with Image.open(image_path) as img:
        original = img.convert("RGB")

    variants = [
        ("original", original),
        ("dark", ImageEnhance.Brightness(original).enhance(0.55)),
        ("bright", ImageEnhance.Brightness(original).enhance(1.4)),
        ("low_contrast", ImageEnhance.Contrast(original).enhance(0.6)),
        ("high_contrast", ImageEnhance.Contrast(original).enhance(1.4)),
    ]

    batch = torch.stack([
        transform(image) for _, image in variants
    ]).to(DEVICE)

    with torch.inference_mode():
        embeddings = model(batch).cpu().numpy()

    scores = np.linalg.norm(
        embeddings - reference,
        axis=1
    )

    actual_defect = bool(
        known_samples[sample_id]["actual_defect"]
    )

    results = []

    for (condition, _), score in zip(variants, scores):
        anomaly_score = float(score)
        detected = anomaly_score > threshold

        results.append({
            "condition": condition,
            "anomaly_score": anomaly_score,
            "predicted_defect": bool(detected),
            "correct": bool(detected == actual_defect),
        })

    original_prediction = results[0]["predicted_defect"]

    changed_predictions = sum(
        result["predicted_defect"] != original_prediction
        for result in results[1:]
    )

    return {
        "sample_id": sample_id,
        "model": "ResNet18 Global Baseline",
        "actual_defect": actual_defect,
        "threshold": threshold,
        "tests": results,
        "changed_predictions": changed_predictions,
        "total_transformations": 4,
        "evaluation_type": "synthetic_robustness",
        "independent_validation": False,
        "note": (
            "Prediction changes under synthetic transforms "
            "do not by themselves prove improved defect detection."
        ),
    }
