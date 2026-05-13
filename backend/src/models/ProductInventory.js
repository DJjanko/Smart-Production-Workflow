import mongoose from "mongoose";

const productInventorySchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, unique: true },
    availableQuantity: { type: Number, required: true, default: 0 },
    reservedQuantity: { type: Number, required: true, default: 0 },
    location: { type: String, default: "FINISHED" }
  },
  { timestamps: true }
);

export const ProductInventory = mongoose.model("ProductInventory", productInventorySchema);
