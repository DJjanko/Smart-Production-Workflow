import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    actor: { type: String, default: "system" },
    action: { type: String, required: true },
    llmProvider: { type: String, enum: ["mock", "openai", "ollama"], default: "mock" },
    mcpTool: { type: String },
    input: { type: mongoose.Schema.Types.Mixed },
    output: { type: mongoose.Schema.Types.Mixed },
    durationMs: { type: Number, default: 0 },
    accurate: { type: Boolean, default: null },
    accuracyNote: { type: String, default: "" },
    useGuard: { type: Boolean, default: null },
    naturalResponse: { type: Boolean, default: false },
    qualityScoreAuto: { type: Number, default: null },
    readabilityScoreAuto: { type: Number, default: null },
    qualityScoreFinal: { type: Number, default: null },
    readabilityScoreFinal: { type: Number, default: null },
    scoreManuallyAdjusted: { type: Boolean, default: false },
    adjustmentNote: { type: String, default: "" },
    evaluatorReason: { type: String, default: "" },
    faithfulToMcpResult: { type: Boolean, default: null }
  },
  { timestamps: true }
);

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
