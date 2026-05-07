import mongoose from "mongoose";

const supplyAlertSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
    partId: { type: mongoose.Schema.Types.ObjectId, ref: "Part" },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["open", "resolved"], default: "open" }
  },
  { timestamps: true }
);

export const SupplyAlert = mongoose.model("SupplyAlert", supplyAlertSchema);
