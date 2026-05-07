import express from "express";
import { runCommand } from "../controllers/aiController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const aiRouter = express.Router();

aiRouter.post("/commands", authenticate, requireRole("admin"), runCommand);
