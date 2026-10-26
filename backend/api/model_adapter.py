
from pydantic import BaseModel, Field


class InspectionInput(BaseModel):
    sample_id: str
    actual_defect: bool
    defect_signal: float = Field(ge=0, le=1)
    brightness: float = Field(ge=0, le=1)


class DemoModel:
    def predict(self, sample: InspectionInput) -> bool:
        return (
            sample.defect_signal >= 0.6
            and sample.brightness >= 0.3
        )
