
import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

DATA_DIR = ROOT / "experiments" / "data" / "mvtec" / "bottle"
RESULTS_DIR = ROOT / "experiments" / "results"

with open(
    RESULTS_DIR / "failure_analysis.json",
    "r",
    encoding="utf-8"
) as f:
    results = json.load(f)

missed = results["missed_defects"]
false_alarms = results["false_alarms"]

samples = [
    (item, "MISSED DEFECT")
    for item in missed
] + [
    (item, "FALSE ALARM")
    for item in false_alarms
]

columns = 3
rows = math.ceil(len(samples) / columns)

fig, axes = plt.subplots(
    rows,
    columns,
    figsize=(12, rows * 4)
)

axes = axes.flatten()

for ax, (item, category) in zip(axes, samples):
    # Supports paths saved on Windows
    relative_path = Path(
        *item["sample_id"].replace("\\", "/").split("/")
    )

    image_path = DATA_DIR / relative_path

    with Image.open(image_path) as img:
        ax.imshow(img.convert("RGB"))

    ax.set_title(
        f"{category}\n"
        f"{relative_path.parent.name}/"
        f"{relative_path.name}\n"
        f"Score: {item['anomaly_score']:.3f}",
        fontsize=10
    )
    ax.axis("off")

for ax in axes[len(samples):]:
    ax.axis("off")

plt.tight_layout()

output_path = RESULTS_DIR / "failure_gallery.png"
plt.savefig(output_path, dpi=160)
plt.show()

print(f"Saved gallery: {output_path}")
