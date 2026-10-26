
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "experiments" / "results"

MAX_ORIGINAL_FAR_INCREASE = 0.05
MAX_RECALL_DROP = 0.02


def evaluate_defense(data):
    checks = []

    for condition in [
        "original",
        "dark",
        "bright",
        "low_contrast",
        "high_contrast"
    ]:
        baseline = data[f"{condition}_baseline"]
        candidate = data[f"{condition}_normalized"]

        baseline_far = (
            baseline["false_alarms"] / baseline["normal"]
        )
        candidate_far = (
            candidate["false_alarms"] / candidate["normal"]
        )

        baseline_recall = (
            baseline["detected_defects"] / baseline["defective"]
        )
        candidate_recall = (
            candidate["detected_defects"] / candidate["defective"]
        )

        allowed_far = (
            baseline_far + MAX_ORIGINAL_FAR_INCREASE
            if condition == "original"
            else baseline_far
        )

        passed = (
            candidate_far <= allowed_far
            and candidate_recall >=
                baseline_recall - MAX_RECALL_DROP
        )

        checks.append({
            "condition": condition,
            "baseline_false_alarm_rate": baseline_far,
            "candidate_false_alarm_rate": candidate_far,
            "baseline_recall": baseline_recall,
            "candidate_recall": candidate_recall,
            "passed": passed
        })

    accepted = all(check["passed"] for check in checks)

    return {
        "candidate": "autocontrast_normalization",
        "decision": "ACCEPT" if accepted else "REJECT",
        "active_model": (
            "candidate" if accepted else "baseline"
        ),
        "checks": checks,
        "evaluation_type": "exploratory",
        "production_approved": False
    }


def main():
    with open(
        RESULTS / "first_defense.json",
        "r",
        encoding="utf-8"
    ) as f:
        data = json.load(f)

    report = evaluate_defense(data)

    print("\n===== FAULTFORGE VERIFICATION GATE =====")

    for check in report["checks"]:
        status = "PASS" if check["passed"] else "FAIL"

        print(
            f"{check['condition']:15} | {status}"
        )

    print(f"\nDecision: {report['decision']}")
    print(f"Active model: {report['active_model']}")

    output = RESULTS / "defense_gate.json"

    with open(output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Report saved: {output}")


if __name__ == "__main__":
    main()
