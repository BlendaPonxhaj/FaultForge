
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.vision.batch_reliability import run_batch_reliability
from backend.vision.reliability_test import run_reliability_test
from pathlib import PurePosixPath

from backend.agents.red_agent import RedAgent
from backend.agents.blue_agent import BlueAgent
from backend.vision.reliability_test import DATA_DIR
import json
from pathlib import Path
router = APIRouter(
    prefix="/api/faultforge",
    tags=["Agent Lab"]
)


class ReliabilityTestRequest(BaseModel):
    sample_id: str


@router.post("/run-test")
def run_test(request: ReliabilityTestRequest):
    try:
        return run_reliability_test(request.sample_id)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

@router.post("/run-batch")
def run_batch_test():
    try:
        return run_batch_reliability()

    except (ValueError, FileNotFoundError) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

@router.post("/red-agent/discover")
def discover_red_agent_failures(request: ReliabilityTestRequest):
    sample_id = request.sample_id.replace("\\", "/")
    relative = PurePosixPath(sample_id)

    if (
        len(relative.parts) != 3
        or relative.parts[0] != "test"
        or relative.is_absolute()
        or any(part in {"", ".", ".."} for part in relative.parts)
        or relative.suffix.lower() not in {".png", ".jpg", ".jpeg"}
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid inspection sample."
        )

    root = DATA_DIR.resolve()
    image_path = root.joinpath(*relative.parts).resolve()

    if not image_path.is_relative_to(root):
        raise HTTPException(
            status_code=400,
            detail="Invalid inspection path."
        )

    if not image_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Inspection image not found."
        )

    actual_defect = relative.parts[1] != "good"

    try:
        agent = RedAgent()

        result = agent.discover_failures(
            image_path,
            actual_defect=actual_defect,
        )

        result["sample_id"] = sample_id
        return result

    except RuntimeError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

@router.post("/blue-agent/evaluate")
def evaluate_blue_agent(request: ReliabilityTestRequest):
    sample_id = request.sample_id.replace("\\", "/")

    # Reuse the exact same image validation as Red Agent.
    from pathlib import PurePosixPath

    relative = PurePosixPath(sample_id)

    if (
        len(relative.parts) != 3
        or relative.parts[0] != "test"
        or relative.is_absolute()
        or any(part in {"", ".", ".."} for part in relative.parts)
        or relative.suffix.lower() not in {".png", ".jpg", ".jpeg"}
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid inspection sample."
        )

    root = DATA_DIR.resolve()
    image_path = root.joinpath(*relative.parts).resolve()

    if not image_path.is_relative_to(root):
        raise HTTPException(
            status_code=400,
            detail="Invalid inspection path."
        )

    if not image_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Inspection image not found."
        )

    actual_defect = relative.parts[1] != "good"

    try:
        result = BlueAgent().evaluate(
            image_path,
            actual_defect=actual_defect,
        )
        result["sample_id"] = sample_id
        return result

    except (ValueError, RuntimeError) as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

@router.get("/verification/dinov2")
def get_dinov2_verification():
    report_path = (
        Path(__file__).resolve().parents[2]
        / "experiments"
        / "results"
        / "dinov2_gate.json"
    )

    if not report_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Run the DINOv2 verification experiment first."
        )

    with open(report_path, encoding="utf-8") as file:
        report = json.load(file)

    return {
        "model": report["model"],
        "candidate": report["candidate"],
        "decision": report["decision"],
        "samples_evaluated": report["samples_evaluated"],
        "baseline": report["baseline"],
        "candidate_metrics": report["candidate_metrics"],
        "checks": report["checks"],
        "new_missed_defects": report["new_missed_defects"],
        "new_false_alarms": report["new_false_alarms"],
        "independent_validation": report["independent_validation"],
        "production_approved": report["production_approved"],
    }
