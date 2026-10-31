
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from fastapi.responses import FileResponse
from pathlib import PurePosixPath
router = APIRouter(prefix="/api/faultforge", tags=["FaultForge"])

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "experiments" / "results"


def read_report(filename):
    path = RESULTS / filename

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Missing report: {filename}"
        )

    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


@router.get("/report")
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
            "roc_auc": baseline["roc_auc"]
        },
        "candidate": {
            "model": candidate["model"],
            "defect_recall": candidate["defect_recall"],
            "false_alarm_rate": candidate["false_alarm_rate"],
            "missed_defects": candidate["false_negatives"],
            "false_alarms": candidate["false_positives"],
            "roc_auc": candidate["roc_auc"]
        },
        "failure_analysis": {
            "recovered_defects": comparison["recovered_defects"],
            "still_missed_defects": comparison["still_missed_defects"],
            "new_missed_defects": comparison["new_missed_defects"],
            "new_false_alarms": comparison["new_false_alarms"]
        },
        "verification": {
            "decision": verification["decision"],
            "checks": verification["checks"],
            "independent_validation": False,
            "production_approved": False
        }
    }

@router.get("/image/{image_path:path}", include_in_schema=False)
def get_inspection_image(image_path: str):
    data_dir = (
        ROOT / "experiments" / "data" / "mvtec" / "bottle"
    ).resolve()

    normalized = image_path.replace("\\", "/")
    relative = PurePosixPath(normalized)

    if (
        relative.is_absolute()
        or ".." in relative.parts
        or not relative.parts
        or relative.parts[0] != "test"
        or relative.suffix.lower() not in {".png", ".jpg", ".jpeg"}
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid inspection image path"
        )

    file_path = data_dir.joinpath(*relative.parts).resolve()

    if not file_path.is_relative_to(data_dir):
        raise HTTPException(
            status_code=400,
            detail="Invalid image location"
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Inspection image not found"
        )

    return FileResponse(file_path)

@router.get("/cases")
def get_inspection_cases():
    baseline = read_report("bottle_baseline.json")
    candidate = read_report("patch_baseline.json")

    old = {
        x["sample_id"].replace("\\", "/"): x
        for x in baseline["predictions"]
    }
    new = {
        x["sample_id"].replace("\\", "/"): x
        for x in candidate["predictions"]
    }

    if set(old) != set(new):
        raise HTTPException(
            status_code=409,
            detail="Model reports contain different samples"
        )

    cases = []

    for sample_id, before in old.items():
        after = new[sample_id]

        if before["actual_defect"] != after["actual_defect"]:
            raise HTTPException(
                status_code=409,
                detail=f"Label mismatch: {sample_id}"
            )

        actual = before["actual_defect"]
        was_detected = before["predicted_defect"]
        is_detected = after["predicted_defect"]

        if actual and not was_detected and is_detected:
            status = "recovered"
        elif actual and not is_detected:
            status = "missed"
        elif actual and was_detected and not is_detected:
            status = "regression"
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
                "anomaly_score": before["anomaly_score"]
            },
            "candidate": {
                "predicted_defect": is_detected,
                "anomaly_score": after["anomaly_score"]
            }
        })

    return {
        "cases": cases,
        "evaluation_type": "exploratory"
    }

@router.get("/heatmap/{image_path:path}", include_in_schema=False)
def get_inspection_heatmap(image_path: str):
    from pathlib import PurePosixPath
    from fastapi.responses import FileResponse

    base = (
        ROOT / "experiments" / "results" / "heatmaps"
    ).resolve()

    relative = PurePosixPath(image_path.replace("\\", "/"))

    if (
        relative.is_absolute()
        or not relative.parts
        or relative.parts[0] != "test"
        or ".." in relative.parts
        or relative.suffix.lower() != ".png"
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid heatmap path"
        )

    file_path = base.joinpath(*relative.parts).resolve()

    if not file_path.is_relative_to(base):
        raise HTTPException(
            status_code=400,
            detail="Invalid heatmap location"
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Heatmap not generated"
        )

    return FileResponse(file_path, media_type="image/png")

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
        item["sample_id"]: item
        for item in analysis["failures"]
    }

    cases = []

    for item in evaluation["predictions"]:
        sample_id = item["sample_id"]
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

        cases.append({
            "sample_id": sample_id,
            "category": sample_id.split("/")[1],
            "actual_defect": actual,
            "status": status,
            "prediction": {
                "predicted_defect": predicted,
                "anomaly_score": item["anomaly_score"],
            },
            "prediction_changes": item["changed_predictions"],
            "failure_type": (
                failures[sample_id]["failure_type"]
                if sample_id in failures
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
