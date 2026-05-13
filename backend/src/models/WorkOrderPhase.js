import mongoose from "mongoose";

const workOrderPhaseSchema = new mongoose.Schema(
  {
    workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    requiredSkill: { type: String, required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    assignedToName: { type: String },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    actualStartedAt: { type: Date },
    actualCompletedAt: { type: Date },
    dependsOn: [{ type: String }],
    status: { type: String, enum: ["planned", "in_progress", "completed"], default: "planned" }
  },
  { timestamps: true }
);

export const WorkOrderPhase = mongoose.model("WorkOrderPhase", workOrderPhaseSchema);
