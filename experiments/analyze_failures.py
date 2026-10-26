
import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]

REPORT = ROOT / "experiments" / "results" / "bottle_baseline.json"
OUTPUT = ROOT / "experiments" / "results" / "failure_analysis.json"

with open(REPORT, "r", encoding="utf-8") as f:
    results = json.load(f)

missed = []
false_alarms = []

for item in results["predictions"]:
    actual = item["actual_defect"]
    predicted = item["predicted_defect"]

    if actual and not predicted:
        missed.append(item)

    elif not actual and predicted:
        false_alarms.append(item)

missed.sort(key=lambda x: x["anomaly_score"])
false_alarms.sort(
    key=lambda x: x["anomaly_score"],
    reverse=True
)

print("\n========== FAULTFORGE FAILURE ANALYSIS ==========")

print(f"\nMissed defects: {len(missed)}")

for item in missed:
    print(
        f"  {item['sample_id']} | "
        f"Score: {item['anomaly_score']:.4f}"
    )

print(f"\nFalse alarms: {len(false_alarms)}")

for item in false_alarms:
    print(
        f"  {item['sample_id']} | "
        f"Score: {item['anomaly_score']:.4f}"
    )

categories = Counter(
    Path(item["sample_id"]).parts[1]
    for item in missed
)

print("\nMissed defects by category:")

for category, count in categories.items():
    print(f"  {category}: {count}")

analysis = {
    "missed_defects": missed,
    "false_alarms": false_alarms,
    "missed_by_category": dict(categories)
}

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(analysis, f, indent=2)

print(f"\nSaved report: {OUTPUT}")
