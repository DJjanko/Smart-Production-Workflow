import mongoose from "mongoose";

const partOrderSchema = new mongoose.Schema(
  {
    workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder" },
    parts: [
      {
        partId: { type: mongoose.Schema.Types.ObjectId, ref: "Part" },
        partName: String,
        quantity: Number
      }
    ],
    status: { type: String, enum: ["created", "received"], default: "received" }
  },
  { timestamps: true }
);

export const PartOrder = mongoose.model("PartOrder", partOrderSchema);
