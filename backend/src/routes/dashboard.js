import express from "express";
import { getDashboard } from "../controllers/dashboardController.js";

export const dashboardRouter = express.Router();

dashboardRouter.get("/", getDashboard);
