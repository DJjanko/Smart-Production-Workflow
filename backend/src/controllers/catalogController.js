import { ActivityLog } from "../models/ActivityLog.js";
import { Employee } from "../models/Employee.js";
import { Inventory } from "../models/Inventory.js";
import { Product } from "../models/Product.js";
import { WorkOrder } from "../models/WorkOrder.js";
import { WorkOrderPhase } from "../models/WorkOrderPhase.js";

export async function getProducts(req, res, next) {
  try {
    res.json(await Product.find().populate("requiredParts.partId").sort({ name: 1 }));
  } catch (error) {
    next(error);
  }
}

export async function getInventory(req, res, next) {
  try {
    res.json(await Inventory.find().populate("partId").sort({ "partId.name": 1 }));
  } catch (error) {
    next(error);
  }
}

export async function getEmployees(req, res, next) {
  try {
    res.json(await Employee.find().sort({ name: 1 }));
  } catch (error) {
    next(error);
  }
}

export async function getWorkOrders(req, res, next) {
  try {
    const workOrders = await WorkOrder.find().sort({ createdAt: -1 }).lean();
    const phases = await WorkOrderPhase.find().sort({ start: 1 }).lean();

    res.json(
      workOrders.map((order) => ({
        ...order,
        phases: phases.filter((phase) => String(phase.workOrderId) === String(order._id))
      }))
    );
  } catch (error) {
    next(error);
  }
}

export async function getActivityLog(req, res, next) {
  try {
    res.json(await ActivityLog.find().sort({ createdAt: -1 }).limit(30));
  } catch (error) {
    next(error);
  }
}
