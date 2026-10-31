
from pathlib import Path

from backend.agents.blue_agent import BlueAgent
from backend.vision.reliability_test import DATA_DIR


CONDITIONS = ("good", "broken_large", "broken_small", "contamination")


def calculate_metrics(records, prediction_key):
    tp = tn = fp = fn = 0

    for record in records:
        actual = record["actual_defect"]
        predicted = record[prediction_key]

        if actual and predicted:
            tp += 1
        elif not actual and not predicted:
            tn += 1
        elif not actual and predicted:
            fp += 1
        else:
            fn += 1

    total = tp + tn + fp + fn

    return {
        "accuracy": (tp + tn) / total if total else 0,
        "precision": tp / (tp + fp) if tp + fp else 0,
        "recall": tp / (tp + fn) if tp + fn else 0,
        "false_alarm_rate": fp / (fp + tn) if fp + tn else 0,
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
    }


def evaluate_dinov2_gate(limit_per_category=0):
    """
    Exploratory comparison on the existing MVTec test set.

    This dataset has already been inspected during
    development, so this is NOT independent validation.
    """
    agent = BlueAgent()
    records = []

    for category in CONDITIONS:
        folder = DATA_DIR / "test" / category

        if not folder.is_dir():
            raise FileNotFoundError(folder)

        images = sorted(folder.glob("*.png"))

        if limit_per_category > 0:
            images = images[:limit_per_category]

        actual_defect = category != "good"

        for image_path in images:
            result = agent.evaluate(
                image_path,
                actual_defect=actual_defect,
            )

            records.append({
                "sample_id": (
                    f"test/{category}/{image_path.name}"
                ),
                "actual_defect": actual_defect,
                "baseline_prediction": result[
                    "baseline_prediction"
                ],
                "consensus_prediction": result[
                    "consensus_prediction"
                ],
            })

    baseline = calculate_metrics(
        records, "baseline_prediction"
    )
    candidate = calculate_metrics(
        records, "consensus_prediction"
    )

    new_missed = [
        item["sample_id"]
        for item in records
        if item["actual_defect"]
        and item["baseline_prediction"]
        and not item["consensus_prediction"]
    ]

    new_false_alarms = [
        item["sample_id"]
        for item in records
        if not item["actual_defect"]
        and not item["baseline_prediction"]
        and item["consensus_prediction"]
    ]

    checks = {
        "recall_not_decreased":
            candidate["recall"] >= baseline["recall"],
        "false_alarm_rate_not_increased":
            candidate["false_alarm_rate"]
            <= baseline["false_alarm_rate"],
        "no_new_missed_defects": len(new_missed) == 0,
        "no_new_false_alarms": len(new_false_alarms) == 0,
    }

    passed = all(checks.values())

    return {
        "model": "Meta DINOv2 ViT-S/14",
        "candidate": "multi_view_majority_vote",
        "decision": (
            "PROMISING_EXPLORATORY"
            if passed else "REJECT_EXPLORATORY"
        ),
        "samples_evaluated": len(records),
        "baseline": baseline,
        "candidate_metrics": candidate,
        "checks": checks,
        "new_missed_defects": new_missed,
        "new_false_alarms": new_false_alarms,
        "evaluation_type": "exploratory",
        "independent_validation": False,
        "production_approved": False,
        "records": records,
    }


if __name__ == "__main__":
    import json

    result = evaluate_dinov2_gate()

    output = (
        Path(__file__).resolve().parents[2]
        / "experiments"
        / "results"
        / "dinov2_gate.json"
    )

    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, "w", encoding="utf-8") as file:
        json.dump(result, file, indent=2)

    print("Model:", result["model"])
    print("Decision:", result["decision"])
    print("Samples:", result["samples_evaluated"])
    print("Baseline:", result["baseline"])
    print("Blue Agent:", result["candidate_metrics"])
    print("Checks:", result["checks"])
    print("Saved:", output)
