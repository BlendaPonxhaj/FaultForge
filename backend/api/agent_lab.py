
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.vision.batch_reliability import run_batch_reliability
from backend.vision.reliability_test import run_reliability_test

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
