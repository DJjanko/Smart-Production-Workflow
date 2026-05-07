import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    items: [orderItemSchema],
    requestedDeadline: { type: Date },
    status: { type: String, enum: ["draft", "confirmed", "in_production", "completed"], default: "confirmed" }
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
