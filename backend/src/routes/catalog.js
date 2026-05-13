import express from "express";
import {
  createEmployee,
  createInventory,
  createManualWorkOrder,
  createOrder,
  createPart,
  createProduct,
  createProductInventory,
  createSupplyAlert,
  createUser,
  createWorkOrderPhase,
  approveWorkOrder,
  deleteEmployee,
  deleteInventory,
  deleteOrder,
  deletePart,
  deleteProduct,
  deleteProductInventory,
  deleteUser,
  deleteWorkOrder,
  deleteWorkOrderPhase,
  getActivityLog,
  getEmployees,
  getInventory,
  getMe,
  getOrders,
  getParts,
  getProductInventory,
  getProducts,
  getSupplyAlerts,
  getUsers,
  getWorkOrderPhases,
  getWorkOrders,
  updateEmployee,
  updateInventory,
  updateMe,
  updateOrder,
  updatePart,
  updateProduct,
  updateProductInventory,
  updateUser,
  updateWorkOrder,
  updateWorkOrderPhase,
  resolveSupplyAlert
} from "../controllers/catalogController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const catalogRouter = express.Router();

const adminOnly = [authenticate, requireRole("admin")];

catalogRouter.route("/products").get(getProducts).post(adminOnly, createProduct);
catalogRouter.route("/products/:id").put(adminOnly, updateProduct).delete(adminOnly, deleteProduct);

catalogRouter.route("/product-inventory").get(getProductInventory).post(adminOnly, createProductInventory);
catalogRouter.route("/product-inventory/:id").put(adminOnly, updateProductInventory).delete(adminOnly, deleteProductInventory);

catalogRouter.route("/parts").get(getParts).post(adminOnly, createPart);
catalogRouter.route("/parts/:id").put(adminOnly, updatePart).delete(adminOnly, deletePart);

catalogRouter.route("/inventory").get(getInventory).post(adminOnly, createInventory);
catalogRouter.route("/inventory/:id").put(adminOnly, updateInventory).delete(adminOnly, deleteInventory);

catalogRouter.route("/employees").get(getEmployees).post(adminOnly, createEmployee);
catalogRouter.route("/employees/:id").put(adminOnly, updateEmployee).delete(adminOnly, deleteEmployee);

catalogRouter.route("/orders").get(getOrders).post(adminOnly, createOrder);
catalogRouter.route("/orders/:id").put(adminOnly, updateOrder).delete(adminOnly, deleteOrder);

catalogRouter.route("/work-orders").get(getWorkOrders).post(adminOnly, createManualWorkOrder);
catalogRouter.route("/work-orders/:id/approve").put(adminOnly, approveWorkOrder);
catalogRouter.route("/work-orders/:id").put(adminOnly, updateWorkOrder).delete(adminOnly, deleteWorkOrder);

catalogRouter.route("/work-order-phases").get(getWorkOrderPhases).post(adminOnly, createWorkOrderPhase);
catalogRouter.route("/work-order-phases/:id").put(authenticate, updateWorkOrderPhase).delete(adminOnly, deleteWorkOrderPhase);

catalogRouter.route("/users").get(adminOnly, getUsers).post(adminOnly, createUser);
catalogRouter.route("/users/:id").put(adminOnly, updateUser).delete(adminOnly, deleteUser);

catalogRouter.route("/me").get(authenticate, getMe).put(authenticate, updateMe);

catalogRouter.route("/supply-alerts").get(adminOnly, getSupplyAlerts).post(authenticate, createSupplyAlert);
catalogRouter.route("/supply-alerts/:id/resolve").put(adminOnly, resolveSupplyAlert);

catalogRouter.get("/activity-log", getActivityLog);
