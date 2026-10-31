
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "experiments" / "results" / "dinov2_evaluation.json"
OUTPUT = ROOT / "experiments" / "results" / "dinov2_failures.json"


def main():
    with INPUT.open(encoding="utf-8") as f:
        report = json.load(f)

    failures = []
    by_category = defaultdict(
        lambda: {"total": 0, "errors": 0, "prediction_changes": 0}
    )

    for item in report["predictions"]:
        sample_id = item["sample_id"]
        category = sample_id.split("/")[1]

        actual = item["actual_defect"]
        predicted = item["predicted_defect"]
        changes = item["changed_predictions"]

        stats = by_category[category]
        stats["total"] += 1
        stats["prediction_changes"] += changes

        if actual != predicted:
            stats["errors"] += 1

            failures.append({
                "sample_id": sample_id,
                "category": category,
                "failure_type": (
                    "false_negative" if actual
                    else "false_positive"
                ),
                "anomaly_score": item["anomaly_score"],
                "prediction_changes": changes,
            })

    summary = {
        "model": report["model"],
        "evaluated_images": report["evaluated_images"],
        "total_failures": len(failures),
        "total_prediction_changes": report["prediction_changes"],
        "categories": dict(by_category),
        "failures": failures,
    }

    OUTPUT.write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )

    print("\n=== FAULTFORGE FAILURE ANALYSIS ===")

    for category, stats in sorted(by_category.items()):
        print(
            f"{category}: "
            f"{stats['errors']}/{stats['total']} errors, "
            f"{stats['prediction_changes']} prediction changes"
        )

    print("\n=== DETECTED FAILURES ===")

    for failure in failures:
        print(
            failure["sample_id"],
            "|", failure["failure_type"],
            "| score:", round(failure["anomaly_score"], 3),
            "| changes:", failure["prediction_changes"],
        )

    print("\nTotal failures:", len(failures))
    print("Report saved to:", OUTPUT)


if __name__ == "__main__":
    main()
