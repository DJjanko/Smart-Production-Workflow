import mongoose from "mongoose";

const workOrderSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        productName: String,
        quantity: Number,
        fromStock: { type: Number, default: 0 },
        toProduce: { type: Number, default: 0 },
        issuedFromStock: { type: Number, default: 0 },
        issuedFromProduction: { type: Number, default: 0 },
        issuedQuantity: { type: Number, default: 0 }
      }
    ],
    status: { type: String, enum: ["planned", "in_progress", "completed", "sold", "delayed"], default: "planned" },
    startDate: { type: Date, required: true },
    dueDate: { type: Date },
    inventoryStatus: {
      type: String,
      enum: ["available", "replenished", "missing"],
      default: "available"
    },
    completedAt: { type: Date },
    issuedAt: { type: Date },
    fulfillmentStatus: {
      type: String,
      enum: ["open", "awaiting_payment", "sold", "issued"],
      default: "open"
    }
  },
  { timestamps: true }
);

export const WorkOrder = mongoose.model("WorkOrder", workOrderSchema);
