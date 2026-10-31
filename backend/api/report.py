
import json
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse


router = APIRouter(
    prefix="/api/faultforge",
    tags=["FaultForge"],
)

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "experiments" / "results"

DATA_DIR = ROOT / "experiments" / "data" / "mvtec" / "bottle"


def read_report(filename: str):
    """Read a generated experiment report."""
    path = RESULTS / filename

    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"Missing report: {filename}",
        )

    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def resolve_inspection_file(
    base_dir: Path,
    image_path: str,
    extensions: set[str],
) -> Path:
    """
    Safely resolve an image located under:
    test/<category>/<filename>.

    Prevents access to files outside the expected directory.
    """
    normalized = image_path.replace("\\", "/")
    relative = PurePosixPath(normalized)

    if (
        relative.is_absolute()
        or len(relative.parts) != 3
        or relative.parts[0] != "test"
        or any(part in {"", ".", ".."} for part in relative.parts)
        or relative.suffix.lower() not in extensions
        or ":" in normalized
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid inspection image path",
        )

    root = base_dir.resolve()
    file_path = root.joinpath(*relative.parts).resolve()

    if not file_path.is_relative_to(root):
        raise HTTPException(
            status_code=400,
            detail="Invalid image location",
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Inspection image not found",
        )

    return file_path


# ============================================================
# LEGACY EXPERIMENTS
#
# Historical ResNet18 comparison endpoints.
# Retained for reproducibility, but not used for Meta DINOv2
# inference or the final Meta-powered demonstration.
#
# deprecated=True marks them as deprecated in OpenAPI.
# They remain callable until explicitly disabled.
# ============================================================


@router.get("/report", deprecated=True)
def get_faultforge_report():
    baseline = read_report("bottle_baseline.json")
    candidate = read_report("patch_baseline.json")
    comparison = read_report("model_comparison.json")
    verification = read_report("model_gate.json")

    return {
        "project": "FaultForge",
        "dataset": "MVTec AD - Bottle",
        "baseline": {
            "model": baseline["model"],
            "defect_recall": baseline["defect_recall"],
            "false_alarm_rate": baseline["false_alarm_rate"],
            "missed_defects": baseline["false_negatives"],
            "false_alarms": baseline["false_positives"],
            "roc_auc": baseline["roc_auc"],
        },
        "candidate": {
            "model": candidate["model"],
            "defect_recall": candidate["defect_recall"],
            "false_alarm_rate": candidate["false_alarm_rate"],
            "missed_defects": candidate["false_negatives"],
            "false_alarms": candidate["false_positives"],
            "roc_auc": candidate["roc_auc"],
        },
        "failure_analysis": {
            "recovered_defects": comparison["recovered_defects"],
            "still_missed_defects": comparison[
                "still_missed_defects"
            ],
            "new_missed_defects": comparison[
                "new_missed_defects"
            ],
            "new_false_alarms": comparison[
                "new_false_alarms"
            ],
        },
        "verification": {
            "decision": verification["decision"],
            "checks": verification["checks"],
            "independent_validation": False,
            "production_approved": False,
        },
    }


@router.get("/cases", deprecated=True)
def get_inspection_cases():
    baseline = read_report("bottle_baseline.json")
    candidate = read_report("patch_baseline.json")

    old = {
        item["sample_id"].replace("\\", "/"): item
        for item in baseline["predictions"]
    }

    new = {
        item["sample_id"].replace("\\", "/"): item
        for item in candidate["predictions"]
    }

    if set(old) != set(new):
        raise HTTPException(
            status_code=409,
            detail="Model reports contain different samples",
        )

    cases = []

    for sample_id, before in old.items():
        after = new[sample_id]

        if before["actual_defect"] != after["actual_defect"]:
            raise HTTPException(
                status_code=409,
                detail=f"Label mismatch: {sample_id}",
            )

        actual = bool(before["actual_defect"])
        was_detected = bool(before["predicted_defect"])
        is_detected = bool(after["predicted_defect"])

        if actual and not was_detected and is_detected:
            status = "recovered"
        elif actual and not is_detected and was_detected:
            status = "regression"
        elif actual and not is_detected:
            status = "missed"
        elif not actual and is_detected:
            status = "false_alarm"
        else:
            status = "other"

        cases.append({
            "sample_id": sample_id,
            "category": sample_id.split("/")[1],
            "actual_defect": actual,
            "status": status,
            "baseline": {
                "predicted_defect": was_detected,
                "anomaly_score": before["anomaly_score"],
            },
            "candidate": {
                "predicted_defect": is_detected,
                "anomaly_score": after["anomaly_score"],
            },
        })

    return {
        "cases": cases,
        "evaluation_type": "exploratory",
    }


@router.get(
    "/heatmap/{image_path:path}",
    include_in_schema=False,
    deprecated=True,
)
def get_inspection_heatmap(image_path: str):
    base = RESULTS / "heatmaps"

    file_path = resolve_inspection_file(
        base,
        image_path,
        extensions={".png"},
    )

    return FileResponse(
        file_path,
        media_type="image/png",
    )


# ============================================================
# SHARED INSPECTION IMAGES
#
# Serves actual inspection images for the frontend.
# Does not run an AI model.
# ============================================================


@router.get(
    "/image/{image_path:path}",
    include_in_schema=False,
)
def get_inspection_image(image_path: str):
    file_path = resolve_inspection_file(
        DATA_DIR,
        image_path,
        extensions={".png", ".jpg", ".jpeg"},
    )

    return FileResponse(file_path)


# ============================================================
# META DINOv2 — INSPECTION CASES
#
# Reads evaluations generated using Meta DINOv2 ViT-S/14.
# The endpoint reads saved reports, not live inference.
# ============================================================


@router.get("/dinov2/cases")
def get_dinov2_cases():
    evaluation = read_report("dinov2_evaluation.json")
    analysis = read_report("dinov2_failures.json")

    if evaluation.get("model") != "Meta DINOv2 ViT-S/14":
        raise HTTPException(
            status_code=409,
            detail="Unexpected evaluation model",
        )

    failures = {
        item["sample_id"].replace("\\", "/"): item
        for item in analysis["failures"]
    }

    cases = []

    for item in evaluation["predictions"]:
        sample_id = item["sample_id"].replace("\\", "/")

        actual = bool(item["actual_defect"])
        predicted = bool(item["predicted_defect"])

        if actual and not predicted:
            status = "missed"
        elif not actual and predicted:
            status = "false_alarm"
        elif actual and predicted:
            status = "detected"
        else:
            status = "correct_normal"

        failure = failures.get(sample_id)

        cases.append({
            "sample_id": sample_id,
            "category": sample_id.split("/")[1],
            "actual_defect": actual,
            "status": status,
            "prediction": {
                "predicted_defect": predicted,
                "anomaly_score": item["anomaly_score"],
            },
            "prediction_changes": item[
                "changed_predictions"
            ],
            "failure_type": (
                failure["failure_type"]
                if failure is not None
                else None
            ),
        })

    return {
        "model": evaluation["model"],
        "evaluation_type": "exploratory",
        "independent_validation": False,
        "metrics": {
            "accuracy": evaluation["accuracy"],
            "precision": evaluation["precision"],
            "recall": evaluation["recall"],
            "f1_score": evaluation["f1_score"],
        },
        "total_cases": len(cases),
        "total_failures": analysis["total_failures"],
        "cases": cases,
    }


# ============================================================
# META DINOv2 — PATCH HEATMAPS
#
# Serves pre-generated DINOv2 patch-distance overlays.
# These are exploratory visualizations, not validated
# segmentation masks.
# ============================================================


@router.get("/dinov2/heatmap/{image_path:path}")
def get_dinov2_heatmap(image_path: str):
    base = RESULTS / "dinov2_heatmaps"

    file_path = resolve_inspection_file(
        base,
        image_path,
        extensions={".png"},
    )

    return FileResponse(
        file_path,
        media_type="image/png",
    )
