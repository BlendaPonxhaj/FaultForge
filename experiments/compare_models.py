
import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "experiments" / "results"


def load_report(filename):
    with open(RESULTS / filename, "r", encoding="utf-8") as f:
        return json.load(f)


def index_predictions(report):
    return {
        item["sample_id"].replace("\\", "/"): item
        for item in report["predictions"]
    }


def main():
    global_report = load_report("bottle_baseline.json")
    patch_report = load_report("patch_baseline.json")

    global_predictions = index_predictions(global_report)
    patch_predictions = index_predictions(patch_report)

    if set(global_predictions) != set(patch_predictions):
        raise ValueError("Models were evaluated on different images!")

    recovered = []
    new_misses = []
    still_missed = []
    fixed_false_alarms = []
    new_false_alarms = []

    for sample_id, old in global_predictions.items():
        new = patch_predictions[sample_id]

        actual = old["actual_defect"]
        if actual != new["actual_defect"]:
            raise ValueError(f"Label mismatch: {sample_id}")

        old_pred = old["predicted_defect"]
        new_pred = new["predicted_defect"]

        if actual:
            if not old_pred and new_pred:
                recovered.append(sample_id)
            elif old_pred and not new_pred:
                new_misses.append(sample_id)
            elif not old_pred and not new_pred:
                still_missed.append(sample_id)
        else:
            if old_pred and not new_pred:
                fixed_false_alarms.append(sample_id)
            elif not old_pred and new_pred:
                new_false_alarms.append(sample_id)

    print("\n========== FAULTFORGE MODEL COMPARISON ==========")

    groups = {
        "RECOVERED DEFECTS": recovered,
        "NEW MISSED DEFECTS": new_misses,
        "STILL MISSED DEFECTS": still_missed,
        "FIXED FALSE ALARMS": fixed_false_alarms,
        "NEW FALSE ALARMS": new_false_alarms,
    }

    for title, samples in groups.items():
        print(f"\n{title}: {len(samples)}")
        for sample_id in samples:
            print(f"  {sample_id}")

    print("\nPATCH MODEL MISSES BY CATEGORY:")
    categories = Counter(
        sample.split("/")[1]
        for sample in still_missed + new_misses
    )
    for category, count in categories.items():
        print(f"  {category}: {count}")

    report = {
        "recovered_defects": recovered,
        "new_missed_defects": new_misses,
        "still_missed_defects": still_missed,
        "fixed_false_alarms": fixed_false_alarms,
        "new_false_alarms": new_false_alarms,
        "evaluation_type": "exploratory",
        "independent_validation": False,
    }

    output = RESULTS / "model_comparison.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nSaved: {output}")


if __name__ == "__main__":
    main()
