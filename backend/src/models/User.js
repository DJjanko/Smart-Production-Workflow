import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "worker"], required: true, default: "worker" },
    language: { type: String, enum: ["sl", "en"], default: "sl" },
    avatarUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
