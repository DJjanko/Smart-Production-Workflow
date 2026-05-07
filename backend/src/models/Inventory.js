import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    partId: { type: mongoose.Schema.Types.ObjectId, ref: "Part", required: true, unique: true },
    availableQuantity: { type: Number, required: true, default: 0 },
    reservedQuantity: { type: Number, required: true, default: 0 },
    location: { type: String, default: "MAIN" }
  },
  { timestamps: true }
);

export const Inventory = mongoose.model("Inventory", inventorySchema);
