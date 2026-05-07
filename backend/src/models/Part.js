import mongoose from "mongoose";

const partSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    unit: { type: String, default: "pcs" },
    minStock: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Part = mongoose.model("Part", partSchema);
