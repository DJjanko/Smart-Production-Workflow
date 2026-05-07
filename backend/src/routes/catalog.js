import express from "express";
import {
  getActivityLog,
  getEmployees,
  getInventory,
  getProducts,
  getWorkOrders
} from "../controllers/catalogController.js";

export const catalogRouter = express.Router();

catalogRouter.get("/products", getProducts);
catalogRouter.get("/inventory", getInventory);
catalogRouter.get("/employees", getEmployees);
catalogRouter.get("/work-orders", getWorkOrders);
catalogRouter.get("/activity-log", getActivityLog);
