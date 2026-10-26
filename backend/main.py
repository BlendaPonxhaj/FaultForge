
from fastapi import FastAPI
from pydantic import BaseModel, Field
from backend.api.model_adapter import InspectionInput, DemoModel
from backend.api.report import router as faultforge_router
from backend.api.agent_lab import router as agent_lab_router

app = FastAPI(
    title="FaultForge API",
    description="AI Reliability & Verification Platform",
    version="0.1.0"
)
app.include_router(faultforge_router)
@app.get("/")
def home():
    return {
        "project": "FaultForge",
        "status": "running"
    }
app.include_router(agent_lab_router)

class InspectionResult(BaseModel):
    sample_id: str
    actual_defect: bool
    predicted_defect: bool


class EvaluationRequest(BaseModel):
    inspections: list[InspectionResult] = Field(min_length=1)


@app.post("/api/evaluate")
def evaluate(request: EvaluationRequest):
    samples = request.inspections

    missed = [
        s.sample_id for s in samples
        if s.actual_defect and not s.predicted_defect
    ]

    false_alarms = [
        s.sample_id for s in samples
        if not s.actual_defect and s.predicted_defect
    ]

    actual_defects = sum(
        s.actual_defect for s in samples
    )

    return {
        "total_inspections": len(samples),
        "missed_defects": len(missed),
        "false_alarms": len(false_alarms),
        "missed_sample_ids": missed,
        "false_alarm_ids": false_alarms,
        "defect_recall": (
            round(
                (actual_defects - len(missed)) / actual_defects,
                3
            )
            if actual_defects else None
        )
    }


class ModelTestRequest(BaseModel):
    samples: list[InspectionInput] = Field(min_length=1)


@app.post("/api/test-model")
def test_model(request: ModelTestRequest):
    model = DemoModel()

    inspections = [
        InspectionResult(
            sample_id=sample.sample_id,
            actual_defect=sample.actual_defect,
            predicted_defect=model.predict(sample)
        )
        for sample in request.samples
    ]

    return {
        "model": "Demo Inspection Model",
        "predictions": [
            item.model_dump() for item in inspections
        ],
        "evaluation": evaluate(
            EvaluationRequest(inspections=inspections)
        )
    }

