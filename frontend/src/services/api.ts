
export interface ModelMetrics {
  model: string;
  defect_recall: number;
  false_alarm_rate: number;
  missed_defects: number;
  false_alarms: number;
  roc_auc: number;
}

export interface FailureAnalysis {
  recovered_defects: string[];
  still_missed_defects: string[];
  new_missed_defects: string[];
  new_false_alarms: string[];
}

export interface Verification {
  decision: string;
  checks: Record<string, boolean>;
  independent_validation: boolean;
  production_approved: boolean;
}

export interface FaultForgeReport {
  project: string;
  dataset: string;
  baseline: ModelMetrics;
  candidate: ModelMetrics;
  failure_analysis: FailureAnalysis;
  verification: Verification;
}

export async function getReport(): Promise<FaultForgeReport> {
  const response = await fetch("/api/faultforge/report");

  if (!response.ok) {
    throw new Error(
      `Failed to fetch report: HTTP ${response.status}`
    );
  }

  return response.json() as Promise<FaultForgeReport>;
}

export function toPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export interface InspectionCase {
  sample_id: string;
  category: string;
  actual_defect: boolean;
  status: string;
  baseline: {
    predicted_defect: boolean;
    anomaly_score: number;
  };
  candidate: {
    predicted_defect: boolean;
    anomaly_score: number;
  };
}

export async function getInspectionCases(): Promise<InspectionCase[]> {
  const response = await fetch("/api/faultforge/cases");

  if (!response.ok) {
    throw new Error(`Cases API error: ${response.status}`);
  }

  const data = await response.json();
  return data.cases as InspectionCase[];
}

export function getInspectionImageUrl(sampleId: string): string {
  return "/api/faultforge/image/" +
    sampleId.split("/").map(encodeURIComponent).join("/");
}
export function getHeatmapUrl(sampleId: string): string {
  return "/api/faultforge/heatmap/" +
    sampleId.split("/").map(encodeURIComponent).join("/");
}


export interface ReliabilityTestResult {
  sample_id: string;
  model: string;
  actual_defect: boolean;
  threshold: number;
  tests: {
    condition: string;
    anomaly_score: number;
    predicted_defect: boolean;
    correct: boolean;
  }[];
  changed_predictions: number;
  total_transformations: number;
  evaluation_type: string;
  independent_validation: boolean;
  note: string;
}

export async function runReliabilityTest(
  sampleId: string
): Promise<ReliabilityTestResult> {
  const response = await fetch("/api/faultforge/run-test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sample_id: sampleId
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? `Test failed: HTTP ${response.status}`
    );
  }

  return response.json() as Promise<ReliabilityTestResult>;
}

export interface BatchConditionResult {
  total_images: number;
  true_positives: number;
  true_negatives: number;
  false_positives: number;
  false_negatives: number;
  defect_recall: number;
  false_alarm_rate: number;
}

export interface BatchReport {
  model: string;
  dataset: string;
  threshold: number;
  conditions: Record<string, BatchConditionResult>;
  evaluation_type: string;
  independent_validation: boolean;
  production_approved: boolean;
}

export async function runBatchTest(): Promise<BatchReport> {
  const response = await fetch("/api/faultforge/run-batch", {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Batch test failed: HTTP ${response.status}`);
  }

  return response.json() as Promise<BatchReport>;
}

export interface Dinov2Case {
  sample_id: string;
  category: string;
  actual_defect: boolean;
  status: "missed" | "false_alarm" | "detected" | "correct_normal";
  prediction: {
    predicted_defect: boolean;
    anomaly_score: number;
  };
  prediction_changes: number;
  failure_type: string | null;
}

export interface Dinov2CasesResponse {
  model: string;
  evaluation_type: string;
  independent_validation: boolean;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
  total_cases: number;
  total_failures: number;
  cases: Dinov2Case[];
}

export async function getDinov2Cases(): Promise<Dinov2CasesResponse> {
  const response = await fetch("/api/faultforge/dinov2/cases");

  if (!response.ok) {
    throw new Error(
      `DINOv2 Cases API error: HTTP ${response.status}`
    );
  }

  return response.json() as Promise<Dinov2CasesResponse>;
}

export function getDinov2HeatmapUrl(sampleId: string): string {
  return "/api/faultforge/dinov2/heatmap/" +
    sampleId.split("/").map(encodeURIComponent).join("/");
}

export interface RedAgentResult {
  sample_id: string;
  model: string;
  threshold: number;
  original_prediction: boolean;
  actual_defect: boolean | null;
  tests: {
    condition: string;
    anomaly_score: number;
    predicted_defect: boolean;
    prediction_flip: boolean;
    correct: boolean | null;
  }[];
  total_tests: number;
  prediction_flips: number;
  incorrect_predictions: number;
  worst_conditions: string[];
  evaluation_type: string;
  independent_validation: boolean;
}

export async function runRedAgent(
  sampleId: string
): Promise<RedAgentResult> {
  const response = await fetch(
    "/api/faultforge/red-agent/discover",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sample_id: sampleId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail ?? `Red Agent failed: HTTP ${response.status}`
    );
  }

  return response.json() as Promise<RedAgentResult>;
}

export interface BlueAgentResult {
  sample_id: string;
  model: string;
  strategy: string;
  threshold: number;
  baseline_prediction: boolean;
  consensus_prediction: boolean;
  changed_decision: boolean;
  defect_votes: number;
  normal_votes: number;
  total_votes: number;
  prediction_flips: number;
  actual_defect: boolean | null;
  baseline_correct: boolean | null;
  consensus_correct: boolean | null;
  comparison: string;
  strategy_approved: boolean;
  independent_validation: boolean;
  note: string;
  votes: {
    condition: string;
    anomaly_score: number;
    predicted_defect: boolean;
  }[];
}

export async function runBlueAgent(
  sampleId: string
): Promise<BlueAgentResult> {
  const response = await fetch(
    "/api/faultforge/blue-agent/evaluate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sample_id: sampleId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.detail ??
      `Blue Agent failed: HTTP ${response.status}`
    );
  }

  return response.json() as Promise<BlueAgentResult>;
}
