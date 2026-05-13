import mongoose from "mongoose";

const pendingMcpActionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    actor: { type: String, default: "admin" },
    provider: { type: String, enum: ["mock", "openai", "ollama"], default: "mock" },
    toolName: { type: String, required: true },
    args: { type: mongoose.Schema.Types.Mixed, default: {} },
    previewMessage: { type: String, default: "" },
    rawInput: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending",
      index: true
    },
    expiresAt: { type: Date, required: true, index: true },
    resolvedAt: { type: Date }
  },
  { timestamps: true }
);

pendingMcpActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingMcpAction = mongoose.model("PendingMcpAction", pendingMcpActionSchema);
