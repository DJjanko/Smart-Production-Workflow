import { ActivityLog } from "../models/ActivityLog.js";
import { Employee } from "../models/Employee.js";
import { Inventory } from "../models/Inventory.js";
import { Order } from "../models/Order.js";
import { PartOrder } from "../models/PartOrder.js";
import { Product } from "../models/Product.js";
import { WorkOrder } from "../models/WorkOrder.js";
import { WorkOrderPhase } from "../models/WorkOrderPhase.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function normalize(value = "") {
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function maxDate(...dates) {
  return new Date(Math.max(...dates.filter(Boolean).map((date) => date.getTime())));
}

export async function getDashboardData() {
  const [workOrders, phases, employees, inventory, activities] = await Promise.all([
    WorkOrder.find().sort({ createdAt: -1 }).limit(8).lean(),
    WorkOrderPhase.find().sort({ start: 1 }).populate("workOrderId", "code").lean(),
    Employee.find().sort({ name: 1 }).lean(),
    Inventory.find().populate("partId").sort({ updatedAt: -1 }).lean(),
    ActivityLog.find().sort({ createdAt: -1 }).limit(8).lean()
  ]);

  const activeWorkOrders = await WorkOrder.countDocuments({ status: { $in: ["planned", "in_progress"] } });
  const lowStock = inventory.filter((item) => item.partId && item.availableQuantity <= item.partId.minStock);
  const workload = employees.map((employee) => {
    const assigned = phases.filter((phase) => String(phase.assignedTo) === String(employee._id));
    const minutes = assigned.reduce((sum, phase) => {
      return sum + Math.max(0, (new Date(phase.end).getTime() - new Date(phase.start).getTime()) / 60000);
    }, 0);
    return {
      id: employee._id,
      name: employee.name,
      skills: employee.skills,
      phaseCount: assigned.length,
      hours: Math.round((minutes / 60) * 10) / 10
    };
  });

  return { activeWorkOrders, lowStock, workOrders, phases, employees: workload, inventory, activities };
}

export async function findProductByName(productName) {
  const products = await Product.find().populate("requiredParts.partId").lean();
  const wanted = normalize(productName);
  return products.find((product) => normalize(product.name) === wanted)
    || products.find((product) => normalize(product.name).includes(wanted) || wanted.includes(normalize(product.name)));
}

export async function checkInventoryForProduct(product, quantity) {
  const inventoryRows = await Inventory.find({
    partId: { $in: product.requiredParts.map((part) => part.partId._id || part.partId) }
  }).populate("partId").lean();

  return product.requiredParts.map((requiredPart) => {
    const part = requiredPart.partId;
    const row = inventoryRows.find((item) => String(item.partId._id) === String(part._id));
    const requiredQuantity = requiredPart.quantity * quantity;
    const availableQuantity = row?.availableQuantity || 0;

    return {
      partId: part._id,
      partName: part.name,
      sku: part.sku,
      requiredQuantity,
      availableQuantity,
      missingQuantity: Math.max(0, requiredQuantity - availableQuantity)
    };
  });
}

async function autoOrderMissingParts(inventoryCheck) {
  const missing = inventoryCheck.filter((item) => item.missingQuantity > 0);
  if (missing.length === 0) return null;

  await Promise.all(
    missing.map((item) =>
      Inventory.updateOne(
        { partId: item.partId },
        { $inc: { availableQuantity: item.missingQuantity }, $setOnInsert: { location: "MAIN", reservedQuantity: 0 } },
        { upsert: true }
      )
    )
  );

  return PartOrder.create({
    parts: missing.map((item) => ({
      partId: item.partId,
      partName: item.partName,
      quantity: item.missingQuantity
    }))
  });
}

async function reserveInventory(product, quantity) {
  await Promise.all(
    product.requiredParts.map((requiredPart) =>
      Inventory.updateOne(
        { partId: requiredPart.partId._id || requiredPart.partId },
        {
          $inc: {
            availableQuantity: -(requiredPart.quantity * quantity),
            reservedQuantity: requiredPart.quantity * quantity
          }
        }
      )
    )
  );
}

async function nextWorkOrderCode() {
  const count = await WorkOrder.countDocuments();
  return `WO-${String(count + 1).padStart(3, "0")}`;
}

async function generateAndAssignPhases({ workOrder, product, quantity, startDate }) {
  const employees = await Employee.find({}).lean();
  const existingPhases = await WorkOrderPhase.find({ status: { $ne: "completed" } }).lean();
  const availability = new Map(
    employees.map((employee) => {
      const currentEnds = existingPhases
        .filter((phase) => String(phase.assignedTo) === String(employee._id))
        .map((phase) => new Date(phase.end));
      return [String(employee._id), currentEnds.length ? maxDate(...currentEnds, startDate) : startDate];
    })
  );
  const completedByName = new Map();
  const created = [];

  for (const templatePhase of product.phases) {
    const dependencyEnd = templatePhase.dependsOn.length
      ? maxDate(...templatePhase.dependsOn.map((name) => completedByName.get(name)).filter(Boolean), startDate)
      : startDate;
    const candidates = employees.filter((employee) => employee.skills.includes(templatePhase.requiredSkill));

    if (candidates.length === 0) {
      throw new Error(`No employee has skill "${templatePhase.requiredSkill}".`);
    }

    const chosen = candidates
      .map((employee) => {
        const employeeStart = maxDate(availability.get(String(employee._id)), dependencyEnd);
        return { employee, start: employeeStart };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime() || a.employee.activePhaseCount - b.employee.activePhaseCount)[0];

    const durationMinutes = templatePhase.durationMinutes * quantity;
    const end = addMinutes(chosen.start, durationMinutes);
    availability.set(String(chosen.employee._id), end);
    completedByName.set(templatePhase.name, end);

    created.push({
      workOrderId: workOrder._id,
      productId: product._id,
      name: templatePhase.name,
      requiredSkill: templatePhase.requiredSkill,
      assignedTo: chosen.employee._id,
      assignedToName: chosen.employee.name,
      start: chosen.start,
      end,
      dependsOn: templatePhase.dependsOn,
      status: "planned"
    });
  }

  const phases = await WorkOrderPhase.insertMany(created);
  await Promise.all(
    employees.map((employee) =>
      WorkOrderPhase.countDocuments({ assignedTo: employee._id, status: { $ne: "completed" } }).then((activePhaseCount) =>
        Employee.updateOne({ _id: employee._id }, { activePhaseCount })
      )
    )
  );
  return phases;
}

export async function processCustomerOrder({ customerName, productName, quantity, requestedDeadline, actor = "admin", llmProvider = "mock", rawInput }) {
  const started = Date.now();
  const product = await findProductByName(productName);

  if (!product) {
    throw new Error(`Product "${productName}" was not found.`);
  }

  const parsedQuantity = Number(quantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
    throw new Error("Quantity must be a positive number.");
  }

  const firstCheck = await checkInventoryForProduct(product, parsedQuantity);
  const partOrder = await autoOrderMissingParts(firstCheck);
  const inventoryStatus = partOrder ? "replenished" : "available";
  await reserveInventory(product, parsedQuantity);

  const order = await Order.create({
    customerName: customerName || "Unknown customer",
    items: [{ productId: product._id, productName: product.name, quantity: parsedQuantity }],
    requestedDeadline
  });

  const startDate = new Date();
  const workOrder = await WorkOrder.create({
    code: await nextWorkOrderCode(),
    orderId: order._id,
    items: order.items,
    status: "planned",
    startDate,
    dueDate: requestedDeadline ? new Date(requestedDeadline) : new Date(Date.now() + 7 * DAY_MS),
    inventoryStatus
  });

  if (partOrder) {
    partOrder.workOrderId = workOrder._id;
    await partOrder.save();
  }

  const phases = await generateAndAssignPhases({ workOrder, product, quantity: parsedQuantity, startDate });
  const output = {
    workOrder,
    phases,
    inventoryCheck: firstCheck,
    partOrder,
    message: `${workOrder.code} created for ${parsedQuantity} x ${product.name}. Inventory was ${inventoryStatus}.`
  };

  await ActivityLog.create({
    actor,
    action: "process_customer_order",
    llmProvider,
    mcpTool: "process_customer_order",
    input: rawInput || { customerName, productName, quantity, requestedDeadline },
    output: {
      workOrderCode: workOrder.code,
      phaseCount: phases.length,
      inventoryStatus,
      orderedParts: partOrder?.parts || []
    },
    durationMs: Date.now() - started
  });

  return output;
}

export async function interpretCommand(command) {
  const normalized = normalize(command);
  const products = await Product.find().lean();
  const product = products.find((item) => normalized.includes(normalize(item.name)))
    || (normalized.includes("ohis") ? products.find((item) => normalize(item.name).includes("ohis")) : null)
    || (normalized.includes("omaric") ? products.find((item) => normalize(item.name).includes("omaric")) : null);

  const quantityMatch = normalized.match(/(\d+)\s*(kos|kom|izdel|kovinsk|elektric|x)?/);
  const customerMatch = command.match(/(?:podjetje|za podjetje)\s+([A-ZČŠŽ][\wČŠŽčšž-]+)/i);
  const wantsWorkOrder = normalized.includes("delovni nalog") || normalized.includes("ustvari") || normalized.includes("naredi");
  const wantsInventory = normalized.includes("zalogo") || normalized.includes("zalogi") || normalized.includes("dovolj delov");

  if (!product || !quantityMatch) {
    return {
      intent: "needs_clarification",
      missing: [!product ? "product" : null, !quantityMatch ? "quantity" : null].filter(Boolean),
      message: "Potrebujem se izdelek in kolicino, da lahko nadaljujem."
    };
  }

  const deadline = normalized.includes("petka") ? nextFriday() : new Date(Date.now() + 7 * DAY_MS);

  if (wantsWorkOrder) {
    return {
      intent: "process_customer_order",
      args: {
        customerName: customerMatch?.[1] || "AluTech",
        productName: product.name,
        quantity: Number(quantityMatch[1]),
        requestedDeadline: deadline
      }
    };
  }

  if (wantsInventory) {
    return {
      intent: "check_inventory",
      args: {
        productName: product.name,
        quantity: Number(quantityMatch[1])
      }
    };
  }

  return {
    intent: "needs_clarification",
    message: "Ali zelite samo preverjanje zaloge ali naj ustvarim delovni nalog?"
  };
}

function nextFriday() {
  const date = new Date();
  const day = date.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  date.setHours(16, 0, 0, 0);
  return date;
}
