import mongoose from "mongoose";

const workOrderSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        productName: String,
        quantity: Number
      }
    ],
    status: { type: String, enum: ["planned", "in_progress", "completed", "delayed"], default: "planned" },
    startDate: { type: Date, required: true },
    dueDate: { type: Date },
    inventoryStatus: {
      type: String,
      enum: ["available", "replenished", "missing"],
      default: "available"
    }
  },
  { timestamps: true }
);

export const WorkOrder = mongoose.model("WorkOrder", workOrderSchema);
