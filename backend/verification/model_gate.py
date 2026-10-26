
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESULTS_DIR = ROOT / "experiments" / "results"


def load_report(filename):
    with open(RESULTS_DIR / filename, "r", encoding="utf-8") as f:
        return json.load(f)


def index_predictions(report):
    return {
        item["sample_id"].replace("\\", "/"): item
        for item in report["predictions"]
    }


def main():
    baseline = load_report("bottle_baseline.json")
    candidate = load_report("patch_baseline.json")

    old = index_predictions(baseline)
    new = index_predictions(candidate)

    if set(old) != set(new):
        raise ValueError("Models must use exactly the same test images.")

    new_missed_defects = []
    new_false_alarms = []

    for sample_id in old:
        before = old[sample_id]
        after = new[sample_id]

        actual = before["actual_defect"]

        if actual != after["actual_defect"]:
            raise ValueError(f"Label mismatch: {sample_id}")

        before_pred = before["predicted_defect"]
        after_pred = after["predicted_defect"]

        if actual and before_pred and not after_pred:
            new_missed_defects.append(sample_id)

        if not actual and not before_pred and after_pred:
            new_false_alarms.append(sample_id)

    checks = {
        "recall_improved": (
            candidate["defect_recall"] > baseline["defect_recall"]
        ),
        "false_alarm_rate_not_increased": (
            candidate["false_alarm_rate"]
            <= baseline["false_alarm_rate"]
        ),
        "no_new_missed_defects": len(new_missed_defects) == 0,
        "no_new_false_alarms": len(new_false_alarms) == 0,
    }

    passed = all(checks.values())

    # This dataset has already been inspected during development.
    # Passing here is NOT independent validation.
    decision = (
        "PROMISING_CANDIDATE" if passed else "REJECT"
    )

    report = {
        "baseline": baseline["model"],
        "candidate": candidate["model"],
        "decision": decision,
        "checks": checks,
        "baseline_recall": baseline["defect_recall"],
        "candidate_recall": candidate["defect_recall"],
        "baseline_false_alarm_rate": baseline["false_alarm_rate"],
        "candidate_false_alarm_rate": candidate["false_alarm_rate"],
        "new_missed_defects": new_missed_defects,
        "new_false_alarms": new_false_alarms,
        "evaluation_type": "exploratory",
        "independent_validation": False,
        "production_approved": False,
    }

    print("\n========== FAULTFORGE MODEL VERIFICATION ==========")

    for name, result in checks.items():
        print(f"{name:35} | {'PASS' if result else 'FAIL'}")

    print(f"\nDecision: {decision}")
    print("Independent validation: NO")
    print("Production approved: NO")

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    output = RESULTS_DIR / "model_gate.json"

    with open(output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nSaved report: {output}")


if __name__ == "__main__":
    main()
