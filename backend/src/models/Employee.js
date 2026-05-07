import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true },
    skills: [{ type: String, required: true, lowercase: true, trim: true }],
    workingHoursPerDay: { type: Number, default: 8 },
    activePhaseCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Employee = mongoose.model("Employee", employeeSchema);
