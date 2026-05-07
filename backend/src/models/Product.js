import mongoose from "mongoose";

const requiredPartSchema = new mongoose.Schema(
  {
    partId: { type: mongoose.Schema.Types.ObjectId, ref: "Part", required: true },
    quantity: { type: Number, required: true }
  },
  { _id: false }
);

const productPhaseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    requiredSkill: { type: String, required: true, lowercase: true, trim: true },
    durationMinutes: { type: Number, required: true },
    dependsOn: [{ type: String }]
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    requiredParts: [requiredPartSchema],
    phases: [productPhaseSchema]
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);
