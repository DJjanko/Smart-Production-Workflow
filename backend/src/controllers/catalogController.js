import { ActivityLog } from "../models/ActivityLog.js";
import { Employee } from "../models/Employee.js";
import { Inventory } from "../models/Inventory.js";
import { Order } from "../models/Order.js";
import { Part } from "../models/Part.js";
import { Product } from "../models/Product.js";
import { SupplyAlert } from "../models/SupplyAlert.js";
import { User } from "../models/User.js";
import { WorkOrder } from "../models/WorkOrder.js";
import { WorkOrderPhase } from "../models/WorkOrderPhase.js";
import { processCustomerOrder, processCustomerOrderItems } from "../services/workflowService.js";
import bcrypt from "bcryptjs";

function cleanNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanStringList(value, lowercase = true) {
  if (Array.isArray(value)) {
    return value
      .map((item) => item.toString().trim())
      .map((item) => (lowercase ? item.toLowerCase() : item))
      .filter(Boolean);
  }

  return value
    ?.toString()
    .split(",")
    .map((item) => item.trim())
    .map((item) => (lowercase ? item.toLowerCase() : item))
    .filter(Boolean) || [];
}

function cleanProductPayload(body) {
  return {
    name: body.name?.trim(),
    description: body.description?.trim() || "",
    requiredParts: Array.isArray(body.requiredParts)
      ? body.requiredParts
          .filter((part) => part.partId && cleanNumber(part.quantity) > 0)
          .map((part) => ({ partId: part.partId, quantity: cleanNumber(part.quantity, 1) }))
      : [],
    phases: Array.isArray(body.phases)
      ? body.phases
          .filter((phase) => phase.name && phase.requiredSkill && cleanNumber(phase.durationMinutes) > 0)
          .map((phase) => ({
            name: phase.name.trim(),
            requiredSkill: phase.requiredSkill.trim().toLowerCase(),
            durationMinutes: cleanNumber(phase.durationMinutes, 30),
            dependsOn: cleanStringList(phase.dependsOn, false)
          }))
      : []
  };
}

function sendRequired(res, field) {
  return res.status(400).json({ message: `${field} is required.` });
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    language: user.language || "sl",
    avatarUrl: user.avatarUrl || "",
    createdAt: user.createdAt
  };
}

export async function getProducts(req, res, next) {
  try {
    res.json(await Product.find().populate("requiredParts.partId").sort({ name: 1 }));
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req, res, next) {
  try {
    const payload = cleanProductPayload(req.body);
    if (!payload.name) return sendRequired(res, "name");
    res.status(201).json(await Product.create(payload));
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const payload = cleanProductPayload(req.body);
    if (!payload.name) return sendRequired(res, "name");
    const product = await Product.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: "Product not found." });
    res.json(product);
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Product not found." });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function getParts(req, res, next) {
  try {
    res.json(await Part.find().sort({ name: 1 }));
  } catch (error) {
    next(error);
  }
}

export async function createPart(req, res, next) {
  try {
    const { name, sku, unit = "kos" } = req.body;
    if (!name?.trim()) return sendRequired(res, "name");
    if (!sku?.trim()) return sendRequired(res, "sku");
    res.status(201).json(await Part.create({ name, sku, unit, minStock: cleanNumber(req.body.minStock) }));
  } catch (error) {
    next(error);
  }
}

export async function updatePart(req, res, next) {
  try {
    const { name, sku, unit = "kos" } = req.body;
    if (!name?.trim()) return sendRequired(res, "name");
    if (!sku?.trim()) return sendRequired(res, "sku");
    const part = await Part.findByIdAndUpdate(
      req.params.id,
      { name, sku, unit, minStock: cleanNumber(req.body.minStock) },
      { new: true, runValidators: true }
    );
    if (!part) return res.status(404).json({ message: "Part not found." });
    res.json(part);
  } catch (error) {
    next(error);
  }
}

export async function deletePart(req, res, next) {
  try {
    const deleted = await Part.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Part not found." });
    await Inventory.deleteMany({ partId: req.params.id });
    res.json({ ok: true });
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

export async function createInventory(req, res, next) {
  try {
    if (!req.body.partId) return sendRequired(res, "partId");
    const inventory = await Inventory.create({
      partId: req.body.partId,
      availableQuantity: cleanNumber(req.body.availableQuantity),
      reservedQuantity: cleanNumber(req.body.reservedQuantity),
      location: req.body.location?.trim() || "MAIN"
    });
    res.status(201).json(await inventory.populate("partId"));
  } catch (error) {
    next(error);
  }
}

export async function updateInventory(req, res, next) {
  try {
    const inventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      {
        availableQuantity: cleanNumber(req.body.availableQuantity),
        reservedQuantity: cleanNumber(req.body.reservedQuantity),
        location: req.body.location?.trim() || "MAIN"
      },
      { new: true, runValidators: true }
    ).populate("partId");
    if (!inventory) return res.status(404).json({ message: "Inventory row not found." });
    res.json(inventory);
  } catch (error) {
    next(error);
  }
}

export async function deleteInventory(req, res, next) {
  try {
    const deleted = await Inventory.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Inventory row not found." });
    res.json({ ok: true });
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

export async function createEmployee(req, res, next) {
  try {
    if (!req.body.name?.trim()) return sendRequired(res, "name");
    res.status(201).json(
      await Employee.create({
        name: req.body.name,
        skills: cleanStringList(req.body.skills),
        workingHoursPerDay: cleanNumber(req.body.workingHoursPerDay, 8)
      })
    );
  } catch (error) {
    next(error);
  }
}

export async function updateEmployee(req, res, next) {
  try {
    if (!req.body.name?.trim()) return sendRequired(res, "name");
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        skills: cleanStringList(req.body.skills),
        workingHoursPerDay: cleanNumber(req.body.workingHoursPerDay, 8)
      },
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ message: "Employee not found." });
    res.json(employee);
  } catch (error) {
    next(error);
  }
}

export async function deleteEmployee(req, res, next) {
  try {
    const deleted = await Employee.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Employee not found." });
    await WorkOrderPhase.updateMany(
      { assignedTo: req.params.id },
      { $unset: { assignedTo: "", assignedToName: "" } }
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function getOrders(req, res, next) {
  try {
    res.json(await Order.find().populate("items.productId").sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
}

export async function createOrder(req, res, next) {
  try {
    if (!req.body.customerName?.trim()) return sendRequired(res, "customerName");
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const cleanItems = items.filter((item) => item.productId && cleanNumber(item.quantity) > 0);
    if (!cleanItems.length) return sendRequired(res, "items");

    const products = await Product.find({ _id: { $in: cleanItems.map((item) => item.productId) } });
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const order = await Order.create({
      customerName: req.body.customerName,
      items: cleanItems.map((item) => ({
        productId: item.productId,
        productName: productById.get(String(item.productId))?.name || item.productName || "Product",
        quantity: cleanNumber(item.quantity, 1)
      })),
      requestedDeadline: req.body.requestedDeadline || undefined,
      status: req.body.status || "confirmed"
    });
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
}

export async function updateOrder(req, res, next) {
  try {
    if (!req.body.customerName?.trim()) return sendRequired(res, "customerName");
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        customerName: req.body.customerName,
        requestedDeadline: req.body.requestedDeadline || undefined,
        status: req.body.status || "confirmed"
      },
      { new: true, runValidators: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json(order);
  } catch (error) {
    next(error);
  }
}

export async function deleteOrder(req, res, next) {
  try {
    const usedByWorkOrder = await WorkOrder.exists({ orderId: req.params.id });
    if (usedByWorkOrder) {
      return res.status(409).json({ message: "Order is linked to a work order." });
    }
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Order not found." });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function getWorkOrders(req, res, next) {
  try {
    const workOrders = await WorkOrder.find().populate("orderId", "customerName requestedDeadline createdAt").sort({ createdAt: -1 }).lean();
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

export async function createManualWorkOrder(req, res, next) {
  try {
    if (Array.isArray(req.body.items) && req.body.items.length > 0) {
      const result = await processCustomerOrderItems({
        customerName: req.body.customerName,
        items: req.body.items,
        requestedDeadline: req.body.requestedDeadline,
        actor: req.user?.name || "admin",
        llmProvider: "mock",
        rawInput: { source: "manual_form", ...req.body }
      });

      return res.status(201).json(result);
    }

    const product = await Product.findById(req.body.productId);
    if (!product) return res.status(404).json({ message: "Product not found." });

    const result = await processCustomerOrder({
      customerName: req.body.customerName,
      productName: product.name,
      quantity: cleanNumber(req.body.quantity, 1),
      requestedDeadline: req.body.requestedDeadline,
      actor: req.user?.name || "admin",
      llmProvider: "mock",
      rawInput: { source: "manual_form", ...req.body }
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateWorkOrder(req, res, next) {
  try {
    const workOrder = await WorkOrder.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
        startDate: req.body.startDate || undefined,
        dueDate: req.body.dueDate || undefined,
        inventoryStatus: req.body.inventoryStatus
      },
      { new: true, runValidators: true }
    );
    if (!workOrder) return res.status(404).json({ message: "Work order not found." });
    res.json(workOrder);
  } catch (error) {
    next(error);
  }
}

export async function deleteWorkOrder(req, res, next) {
  try {
    const deleted = await WorkOrder.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Work order not found." });
    await WorkOrderPhase.deleteMany({ workOrderId: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function getWorkOrderPhases(req, res, next) {
  try {
    res.json(await WorkOrderPhase.find().populate("workOrderId", "code").sort({ start: 1 }));
  } catch (error) {
    next(error);
  }
}

export async function createWorkOrderPhase(req, res, next) {
  try {
    const phase = await WorkOrderPhase.create({
      workOrderId: req.body.workOrderId,
      productId: req.body.productId,
      name: req.body.name,
      requiredSkill: req.body.requiredSkill,
      assignedTo: req.body.assignedTo || undefined,
      assignedToName: req.body.assignedToName,
      start: req.body.start,
      end: req.body.end,
      dependsOn: cleanStringList(req.body.dependsOn, false),
      status: req.body.status || "planned"
    });
    res.status(201).json(phase);
  } catch (error) {
    next(error);
  }
}

export async function updateWorkOrderPhase(req, res, next) {
  try {
    const previous = await WorkOrderPhase.findById(req.params.id).lean();
    if (!previous) return res.status(404).json({ message: "Phase not found." });

    const isAdmin = req.user?.role === "admin";
    let update;

    if (isAdmin) {
      update = {
        name: req.body.name,
        requiredSkill: req.body.requiredSkill,
        assignedTo: req.body.assignedTo || undefined,
        assignedToName: req.body.assignedToName,
        start: req.body.start,
        end: req.body.end,
        dependsOn: cleanStringList(req.body.dependsOn, false),
        status: req.body.status || "planned"
      };
    } else {
      const employee = await Employee.findOne({
        $or: [
          { userId: req.user.sub },
          { name: req.user.name }
        ]
      }).lean();
      const isAssigned = employee && (
        String(previous.assignedTo || "") === String(employee._id) ||
        previous.assignedToName === employee.name
      );

      if (!isAssigned) {
        return res.status(403).json({ message: "You can only update phases assigned to you." });
      }

      update = { status: req.body.status || previous.status };
    }

    const phase = await WorkOrderPhase.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    if (!phase) return res.status(404).json({ message: "Phase not found." });
    const employeeIds = [...new Set([previous?.assignedTo, phase.assignedTo].filter(Boolean).map((id) => String(id)))];
    await Promise.all(
      employeeIds.map((employeeId) =>
        WorkOrderPhase.countDocuments({ assignedTo: employeeId, status: { $ne: "completed" } }).then((activePhaseCount) =>
          Employee.updateOne({ _id: employeeId }, { activePhaseCount })
        )
      )
    );
    res.json(phase);
  } catch (error) {
    next(error);
  }
}

export async function deleteWorkOrderPhase(req, res, next) {
  try {
    const deleted = await WorkOrderPhase.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Phase not found." });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function getUsers(req, res, next) {
  try {
    res.json(await User.find().select("-passwordHash").sort({ name: 1 }));
  } catch (error) {
    next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    const { name, email, password, role = "worker", language = "sl" } = req.body;
    if (!name?.trim()) return sendRequired(res, "name");
    if (!email?.trim()) return sendRequired(res, "email");
    if (!password) return sendRequired(res, "password");
    const user = await User.create({ name, email, role, language, passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json(serializeUser(user));
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const { name, email, password, role = "worker", language = "sl" } = req.body;
    if (!name?.trim()) return sendRequired(res, "name");
    if (!email?.trim()) return sendRequired(res, "email");
    const update = { name, email, role, language };
    if (password) update.passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json(user);
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.sub).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json(serializeUser(user));
  } catch (error) {
    next(error);
  }
}

export async function updateMe(req, res, next) {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (req.body.newPassword) {
      if (!(await bcrypt.compare(req.body.currentPassword || "", user.passwordHash))) {
        return res.status(400).json({ message: "Current password is not correct." });
      }
      user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    }

    if (typeof req.body.avatarUrl === "string") user.avatarUrl = req.body.avatarUrl;
    if (["sl", "en"].includes(req.body.language)) user.language = req.body.language;
    await user.save();
    res.json(serializeUser(user));
  } catch (error) {
    next(error);
  }
}

export async function getSupplyAlerts(req, res, next) {
  try {
    res.json(await SupplyAlert.find({ status: "open" }).populate("partId").sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
}

export async function createSupplyAlert(req, res, next) {
  try {
    const message = req.body.message?.trim();
    if (!message) return sendRequired(res, "message");
    const alert = await SupplyAlert.create({
      createdBy: req.user.sub,
      createdByName: req.user.name || "Uporabnik",
      partId: req.body.partId || undefined,
      message
    });
    res.status(201).json(await alert.populate("partId"));
  } catch (error) {
    next(error);
  }
}

export async function resolveSupplyAlert(req, res, next) {
  try {
    const alert = await SupplyAlert.findByIdAndUpdate(req.params.id, { status: "resolved" }, { new: true }).populate("partId");
    if (!alert) return res.status(404).json({ message: "Alert not found." });
    res.json(alert);
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found." });
    res.json({ ok: true });
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
