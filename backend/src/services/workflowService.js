import { ActivityLog } from "../models/ActivityLog.js";
import { Employee } from "../models/Employee.js";
import { Inventory } from "../models/Inventory.js";
import { Order } from "../models/Order.js";
import { PartOrder } from "../models/PartOrder.js";
import { Product } from "../models/Product.js";
import { ProductInventory } from "../models/ProductInventory.js";
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
  const [workOrders, phases, employees, productInventory, products, activities] = await Promise.all([
    WorkOrder.find().sort({ createdAt: -1 }).populate("orderId", "customerName requestedDeadline").lean(),
    WorkOrderPhase.find().sort({ start: 1 }).populate("workOrderId", "code").lean(),
    Employee.find().sort({ name: 1 }).lean(),
    ProductInventory.find().populate("productId").sort({ updatedAt: -1 }).lean(),
    Product.find().sort({ name: 1 }).lean(),
    ActivityLog.find().sort({ createdAt: -1 }).limit(8).lean()
  ]);

  const activeWorkOrders = await WorkOrder.countDocuments({ status: { $in: ["planned", "in_progress"] } });
  const productInventoryById = new Map(productInventory.map((item) => [String(item.productId?._id || item.productId), item]));
  const inventory = products.map((product) => {
    const row = productInventoryById.get(String(product._id));
    return row || {
      _id: `missing-${product._id}`,
      productId: product,
      availableQuantity: 0,
      reservedQuantity: 0,
      location: "FINISHED"
    };
  });
  const lowStock = inventory.filter((item) => item.productId && item.availableQuantity <= 0);
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
  if (quantity <= 0) return;

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

async function reserveFinishedProducts(product, quantity) {
  if (quantity <= 0) return 0;

  const row = await ProductInventory.findOne({ productId: product._id });
  const available = Math.max(0, row?.availableQuantity || 0);
  const fromStock = Math.min(available, quantity);

  if (fromStock > 0) {
    await ProductInventory.updateOne(
      { productId: product._id },
      { $inc: { availableQuantity: -fromStock, reservedQuantity: fromStock }, $setOnInsert: { location: "FINISHED" } },
      { upsert: true }
    );
  }

  return fromStock;
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

  const fromStock = await reserveFinishedProducts(product, parsedQuantity);
  const toProduce = Math.max(0, parsedQuantity - fromStock);
  const firstCheck = toProduce > 0 ? await checkInventoryForProduct(product, toProduce) : [];
  const partOrder = await autoOrderMissingParts(firstCheck);
  const inventoryStatus = partOrder ? "replenished" : "available";
  await reserveInventory(product, toProduce);

  const order = await Order.create({
    customerName: customerName || "Unknown customer",
    items: [{ productId: product._id, productName: product.name, quantity: parsedQuantity }],
    requestedDeadline
  });

  const startDate = new Date();
  const workOrder = await WorkOrder.create({
    code: await nextWorkOrderCode(),
    orderId: order._id,
    items: [{ productId: product._id, productName: product.name, quantity: parsedQuantity, fromStock, toProduce }],
    status: toProduce > 0 ? "planned" : "completed",
    startDate,
    dueDate: requestedDeadline ? new Date(requestedDeadline) : new Date(Date.now() + 7 * DAY_MS),
    inventoryStatus
  });

  if (partOrder) {
    partOrder.workOrderId = workOrder._id;
    await partOrder.save();
  }

  const phases = toProduce > 0 ? await generateAndAssignPhases({ workOrder, product, quantity: toProduce, startDate }) : [];
  const output = {
    workOrder,
    phases,
    inventoryCheck: firstCheck,
    partOrder,
    message: `${workOrder.code} created for ${parsedQuantity} x ${product.name}. ${fromStock} from finished stock, ${toProduce} to produce. Inventory was ${inventoryStatus}.`
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
      finishedStockUsed: fromStock,
      orderedParts: partOrder?.parts || []
    },
    durationMs: Date.now() - started
  });

  return output;
}

export async function processCustomerOrderItems({ customerName, items, requestedDeadline, actor = "admin", llmProvider = "mock", rawInput }) {
  const started = Date.now();
  const cleanItems = Array.isArray(items)
    ? items
        .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }))
        .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0)
    : [];

  if (cleanItems.length === 0) {
    throw new Error("At least one product item is required.");
  }

  const products = await Product.find({ _id: { $in: cleanItems.map((item) => item.productId) } })
    .populate("requiredParts.partId")
    .lean();
  const productById = new Map(products.map((product) => [String(product._id), product]));
  const orderItems = [];
  const workOrderItems = [];
  const inventoryChecks = [];
  const partOrders = [];
  let totalToProduce = 0;
  let totalFromStock = 0;

  for (const item of cleanItems) {
    const product = productById.get(String(item.productId));
    if (!product) {
      throw new Error(`Product "${item.productId}" was not found.`);
    }

    const fromStock = await reserveFinishedProducts(product, item.quantity);
    const toProduce = Math.max(0, item.quantity - fromStock);
    totalFromStock += fromStock;
    totalToProduce += toProduce;
    const inventoryCheck = toProduce > 0 ? await checkInventoryForProduct(product, toProduce) : [];
    const partOrder = await autoOrderMissingParts(inventoryCheck);
    await reserveInventory(product, toProduce);

    orderItems.push({ productId: product._id, productName: product.name, quantity: item.quantity });
    workOrderItems.push({ productId: product._id, productName: product.name, quantity: item.quantity, fromStock, toProduce });
    inventoryChecks.push({ productId: product._id, productName: product.name, quantity: item.quantity, inventoryCheck });
    if (partOrder) partOrders.push(partOrder);
  }

  const order = await Order.create({
    customerName: customerName || "Unknown customer",
    items: orderItems,
    requestedDeadline
  });

  const startDate = new Date();
  const inventoryStatus = partOrders.length ? "replenished" : "available";
  const workOrder = await WorkOrder.create({
    code: await nextWorkOrderCode(),
    orderId: order._id,
    items: workOrderItems,
    status: totalToProduce > 0 ? "planned" : "completed",
    startDate,
    dueDate: requestedDeadline ? new Date(requestedDeadline) : new Date(Date.now() + 7 * DAY_MS),
    inventoryStatus
  });

  await Promise.all(
    partOrders.map((partOrder) => {
      partOrder.workOrderId = workOrder._id;
      return partOrder.save();
    })
  );

  const phases = [];
  for (const item of cleanItems) {
    const workOrderItem = workOrderItems.find((candidate) => String(candidate.productId) === String(item.productId));
    if (!workOrderItem || workOrderItem.toProduce <= 0) continue;
    const product = productById.get(String(item.productId));
    phases.push(...await generateAndAssignPhases({ workOrder, product, quantity: workOrderItem.toProduce, startDate }));
  }

  const output = {
    workOrder,
    phases,
    inventoryCheck: inventoryChecks,
    partOrders,
    message: `${workOrder.code} created for ${orderItems.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}. ${totalFromStock} from finished stock, ${totalToProduce} to produce. Inventory was ${inventoryStatus}.`
  };

  await ActivityLog.create({
    actor,
    action: "process_customer_order",
    llmProvider,
    mcpTool: "process_customer_order",
    input: rawInput || { customerName, items: cleanItems, requestedDeadline },
    output: {
      workOrderCode: workOrder.code,
      itemCount: orderItems.length,
      phaseCount: phases.length,
      inventoryStatus,
      finishedStockUsed: totalFromStock,
      orderedParts: partOrders.flatMap((partOrder) => partOrder.parts || [])
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
