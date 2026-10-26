
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.agents.red_agent import RedAgent

DATA_DIR = ROOT / "experiments" / "data" / "mvtec" / "bottle"

OUTPUT_DIR = ROOT / "experiments" / "generated_tests"

image_path = (
    DATA_DIR / "test" / "broken_small" / "007.png"
)

agent = RedAgent(OUTPUT_DIR)

generated = agent.generate_tests(image_path)

print("\n========== RED AGENT TEST GENERATION ==========")

for item in generated:
    print(f"{item['test']}: {item['image']}")

report_path = OUTPUT_DIR / "test_manifest.json"

with open(report_path, "w", encoding="utf-8") as f:
    json.dump(generated, f, indent=2)

print(f"\nSaved manifest: {report_path}")
