
from collections import Counter

from backend.agents.red_agent import RedAgent


class BlueAgent:
    """
    Experimental defense-strategy evaluator.

    Uses real DINOv2 predictions obtained by RedAgent.
    Does not retrain the model or modify calibration.

    Strategy: majority vote across five visual conditions.
    """

    STRATEGY_NAME = "multi_view_majority_vote"

    def __init__(self):
        self.red_agent = RedAgent()

    def evaluate(self, image_path, actual_defect=None):
        """
        Compare baseline and multi-view consensus for one image.

        This is exploratory analysis, not independent
        validation of a defense improvement.
        """
        red_result = self.red_agent.discover_failures(
            image_path,
            actual_defect=actual_defect,
        )

        tests = red_result["tests"]

        if not tests:
            raise ValueError("No DINOv2 predictions available.")

        predictions = [
            bool(test["predicted_defect"])
            for test in tests
        ]

        votes = Counter(predictions)

        # Five conditions => no tie is possible.
        consensus_prediction = votes[True] > votes[False]

        original_prediction = bool(
            red_result["original_prediction"]
        )

        changed_decision = (
            consensus_prediction != original_prediction
        )

        baseline_correct = (
            None
            if actual_defect is None
            else original_prediction == actual_defect
        )

        consensus_correct = (
            None
            if actual_defect is None
            else consensus_prediction == actual_defect
        )

        if actual_defect is None:
            comparison = "unverified"
        elif baseline_correct and consensus_correct:
            comparison = "both_correct"
        elif not baseline_correct and not consensus_correct:
            comparison = "both_incorrect"
        elif consensus_correct:
            comparison = "improved_on_sample"
        else:
            comparison = "regressed_on_sample"

        vote_details = [
            {
                "condition": test["condition"],
                "anomaly_score": test["anomaly_score"],
                "predicted_defect": test["predicted_defect"],
            }
            for test in tests
        ]

        return {
            "sample_id": str(image_path).replace("\\", "/"),
            "model": red_result["model"],
            "strategy": self.STRATEGY_NAME,
            "threshold": red_result["threshold"],
            "baseline_prediction": original_prediction,
            "consensus_prediction": consensus_prediction,
            "changed_decision": changed_decision,
            "defect_votes": votes[True],
            "normal_votes": votes[False],
            "total_votes": len(predictions),
            "prediction_flips": red_result["prediction_flips"],
            "actual_defect": actual_defect,
            "baseline_correct": baseline_correct,
            "consensus_correct": consensus_correct,
            "comparison": comparison,
            "votes": vote_details,
            "evaluation_type": "exploratory_blue_agent",
            "independent_validation": False,
            "strategy_approved": False,
            "note": (
                "Multi-view majority voting is an experimental "
                "decision strategy. Synthetic views are correlated. "
                "Per-sample gains do not prove general improvement. "
                "An independent verification gate is required."
            ),
        }
