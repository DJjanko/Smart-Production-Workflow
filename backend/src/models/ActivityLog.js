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
    naturalResponse: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
