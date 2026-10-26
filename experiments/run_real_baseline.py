
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.metrics import roc_auc_score
from torchvision import models, transforms


# Project configuration
PROJECT_ROOT = Path(__file__).resolve().parents[1]

DATA_DIR = PROJECT_ROOT / "experiments" / "data" / "mvtec" / "bottle"
RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"

IMAGE_SIZE = 224
BATCH_SIZE = 16
RANDOM_SEED = 42

torch.manual_seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_images(folder):
    return sorted(
        path for path in Path(folder).rglob("*")
        if path.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )


def create_model():
    print(f"Loading pretrained ResNet18 on {DEVICE}...", flush=True)

    model = models.resnet18(
        weights=models.ResNet18_Weights.DEFAULT
    )

    # Remove final classification layer
    model.fc = torch.nn.Identity()

    model = model.to(DEVICE)
    model.eval()

    return model


transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


@torch.no_grad()
def extract_features(model, image_paths):
    features = []

    for start in range(0, len(image_paths), BATCH_SIZE):
        batch_paths = image_paths[start:start + BATCH_SIZE]

        images = []

        for path in batch_paths:
            with Image.open(path) as img:
                images.append(transform(img.convert("RGB")))

        batch = torch.stack(images).to(DEVICE)

        embeddings = model(batch)
        features.append(embeddings.cpu().numpy())

    return np.concatenate(features, axis=0)


def calculate_scores(features, reference):
    distances = np.linalg.norm(
        features - reference,
        axis=1
    )

    return distances


def main():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    train_good = load_images(DATA_DIR / "train" / "good")
    test_good = load_images(DATA_DIR / "test" / "good")

    defect_folders = [
        folder for folder in (DATA_DIR / "test").iterdir()
        if folder.is_dir() and folder.name != "good"
    ]

    test_defective = []

    for folder in defect_folders:
        test_defective.extend(load_images(folder))

    test_defective = sorted(test_defective)

    if len(train_good) < 10:
        raise ValueError("Not enough training images found.")

    if not test_good or not test_defective:
        raise ValueError("Test images are missing.")

    print(f"Normal training images: {len(train_good)}")
    print(f"Normal test images: {len(test_good)}")
    print(f"Defective test images: {len(test_defective)}")

    # Use only normal training images
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

    print("Extracting normal reference features...", flush=True)

    reference_features = extract_features(
        model, reference_paths
    )

    reference = reference_features.mean(axis=0)

    print("Calibrating anomaly threshold...", flush=True)

    validation_features = extract_features(
        model, validation_paths
    )

    validation_scores = calculate_scores(
        validation_features,
        reference
    )

    # 95th percentile of normal validation scores
    threshold = float(np.percentile(validation_scores, 95))

    print("Evaluating test images...", flush=True)

    test_paths = test_good + test_defective

    labels = np.array(
        [0] * len(test_good) +
        [1] * len(test_defective)
    )

    test_features = extract_features(
        model, test_paths
    )

    scores = calculate_scores(test_features, reference)

    predictions = (scores > threshold).astype(int)

    tp = int(np.sum((labels == 1) & (predictions == 1)))
    tn = int(np.sum((labels == 0) & (predictions == 0)))
    fp = int(np.sum((labels == 0) & (predictions == 1)))
    fn = int(np.sum((labels == 1) & (predictions == 0)))

    recall = tp / (tp + fn) if tp + fn else None
    false_alarm_rate = fp / (fp + tn) if fp + tn else None

    auc = float(roc_auc_score(labels, scores))

    results = {
        "model": "ResNet18 Feature Baseline",
        "dataset": "MVTec AD - Bottle",
        "reference_images": len(reference_paths),
        "validation_images": len(validation_paths),
        "test_images": len(test_paths),
        "threshold": threshold,
        "true_positives": tp,
        "true_negatives": tn,
        "false_positives": fp,
        "false_negatives": fn,
        "defect_recall": recall,
        "false_alarm_rate": false_alarm_rate,
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

    output_path = RESULTS_DIR / "bottle_baseline.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n========== FAULTFORGE BASELINE ==========")
    print(f"Defect recall: {recall:.4f}")
    print(f"False alarm rate: {false_alarm_rate:.4f}")
    print(f"ROC-AUC: {auc:.4f}")
    print(f"Missed defects: {fn}")
    print(f"False alarms: {fp}")
    print(f"\nSaved report: {output_path}")


if __name__ == "__main__":
    main()
