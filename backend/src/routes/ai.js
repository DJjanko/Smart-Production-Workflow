import express from "express";
import {
  acceptPendingAction,
  declinePendingAction,
  getPendingActions,
  runCommand
} from "../controllers/aiController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const aiRouter = express.Router();

aiRouter.post("/commands", authenticate, runCommand);
aiRouter.get("/pending-actions", authenticate, getPendingActions);
aiRouter.put("/pending-actions/:id/accept", authenticate, acceptPendingAction);
aiRouter.put("/pending-actions/:id/decline", authenticate, declinePendingAction);
