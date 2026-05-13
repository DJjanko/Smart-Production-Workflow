import express from "express";
import {
  acceptPendingAction,
  declinePendingAction,
  getPendingActions,
  runCommand
} from "../controllers/aiController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const aiRouter = express.Router();

aiRouter.post("/commands", authenticate, requireRole("admin"), runCommand);
aiRouter.get("/pending-actions", authenticate, requireRole("admin"), getPendingActions);
aiRouter.put("/pending-actions/:id/accept", authenticate, requireRole("admin"), acceptPendingAction);
aiRouter.put("/pending-actions/:id/decline", authenticate, requireRole("admin"), declinePendingAction);
