
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

from backend.vision.meta_dinov2 import extract_meta_features
from backend.vision.reliability_test import get_inspector


class RedAgent:
    """
    Deterministic adversarial testing agent powered
    by real Meta DINOv2 inference.

    Generates controlled perturbations and discovers
    prediction flips or incorrect predictions.
    """

    def __init__(self, output_dir=None):
        self.output_dir = (
            Path(output_dir) if output_dir else None
        )

    @staticmethod
    def make_variants(image):
        return [
            ("original", image.copy()),
            ("dark", ImageEnhance.Brightness(image).enhance(0.55)),
            ("bright", ImageEnhance.Brightness(image).enhance(1.4)),
            ("low_contrast", ImageEnhance.Contrast(image).enhance(0.6)),
            ("high_contrast", ImageEnhance.Contrast(image).enhance(1.4)),
        ]

    def generate_tests(self, image_path):
        """Preserve the original image-generation interface."""
        if self.output_dir is None:
            raise ValueError("An output directory is required.")

        self.output_dir.mkdir(
            parents=True, exist_ok=True
        )

        image_path = Path(image_path)

        with Image.open(image_path) as img:
            original = img.convert("RGB")

        generated = []

        for name, image in self.make_variants(original):
            if name == "original":
                continue

            output_path = (
                self.output_dir /
                f"{image_path.stem}_{name}.png"
            )

            image.save(output_path)

            generated.append({
                "test": name,
                "source": str(image_path),
                "image": str(output_path),
            })

        return generated

    def discover_failures(self, image_path, actual_defect=None):
        """
        Run Meta DINOv2 on original and modified images.
        Does not save transformed images to disk.
        """
        image_path = Path(image_path)

        with Image.open(image_path) as img:
            original = img.convert("RGB")

        variants = self.make_variants(original)

        reference, threshold = get_inspector()

        embeddings = extract_meta_features(
            [image for _, image in variants]
        )

        scores = np.linalg.norm(
            embeddings - reference,
            axis=1,
        )

        original_prediction = bool(
            float(scores[0]) > threshold
        )

        results = []

        for (name, _), score in zip(variants, scores):
            predicted = bool(float(score) > threshold)

            prediction_flip = (
                predicted != original_prediction
            )

            correct = (
                None
                if actual_defect is None
                else predicted == actual_defect
            )

            results.append({
                "condition": name,
                "anomaly_score": float(score),
                "predicted_defect": predicted,
                "prediction_flip": prediction_flip,
                "correct": correct,
            })

        failures = [
            result
            for result in results
            if result["correct"] is False
        ]

        flips = [
            result
            for result in results
            if result["prediction_flip"]
        ]

        return {
            "sample_id": image_path.name,
            "model": "Meta DINOv2 ViT-S/14",
            "threshold": threshold,
            "original_prediction": original_prediction,
            "actual_defect": actual_defect,
            "tests": results,
            "total_tests": len(results),
            "prediction_flips": len(flips),
            "incorrect_predictions": len(failures),
            "worst_conditions": [
                result["condition"]
                for result in failures
            ],
            "evaluation_type": "exploratory_red_agent",
            "independent_validation": False,
        }
