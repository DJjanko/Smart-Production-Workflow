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
  const fulfillmentStats = workOrders.reduce(
    (stats, workOrder) => {
      const completed = ["completed", "sold"].includes(workOrder.status) || ["awaiting_payment", "sold", "issued"].includes(workOrder.fulfillmentStatus);
      const sold = workOrder.status === "sold" || ["sold", "issued"].includes(workOrder.fulfillmentStatus);
      if (!completed) return stats;

      for (const item of workOrder.items || []) {
        const produced = item.issuedFromProduction || item.toProduce || 0;
        stats.completedProducts += produced;
        if (sold) {
          const issued = item.issuedQuantity || item.quantity || 0;
          stats.issuedProducts += issued;
        }
      }

      return stats;
    },
    { completedProducts: 0, issuedProducts: 0 }
  );
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

  return { activeWorkOrders, lowStock, workOrders, phases, employees: workload, inventory, activities, fulfillmentStats };
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
  if (quantity <= 0) return [];

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

  return product.requiredParts.map((requiredPart) => ({
    partId: requiredPart.partId._id || requiredPart.partId,
    partName: requiredPart.partId?.name || requiredPart.partId?.toString() || "",
    quantity: requiredPart.quantity * quantity
  }));
}

async function reserveFinishedProducts(product, quantity) {
  if (quantity <= 0) return 0;

  const row = await ProductInventory.findOne({ productId: product._id });
  const available = Math.max(0, (row?.availableQuantity || 0) - (row?.reservedQuantity || 0));
  const fromStock = Math.min(available, quantity);

  if (fromStock > 0) {
    await ProductInventory.updateOne(
      { productId: product._id },
      { $inc: { reservedQuantity: fromStock }, $setOnInsert: { location: "FINISHED", availableQuantity: 0 } },
      { upsert: true }
    );
  }

  return fromStock;
}

async function releaseReservedFinishedProducts(productId, quantity) {
  if (!productId || quantity <= 0) return;

  await ProductInventory.updateOne(
    { productId },
    { $inc: { reservedQuantity: -quantity } }
  );
}

export async function completeWorkOrderForApproval(workOrderId, { actor = "system", llmProvider = "mock", rawInput } = {}) {
  const started = Date.now();
  const workOrder = await WorkOrder.findById(workOrderId);
  if (!workOrder) {
    throw new Error("Work order was not found.");
  }

  if (["awaiting_payment", "sold", "issued"].includes(workOrder.fulfillmentStatus)) {
    return workOrder;
  }

  const completedAt = new Date();
  const updatedItems = workOrder.items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const fromStock = Number(item.fromStock) || 0;
    const toProduce = Number(item.toProduce ?? Math.max(0, quantity - fromStock)) || 0;

    return {
      productId: item.productId,
      productName: item.productName,
      quantity,
      fromStock,
      toProduce,
      issuedFromStock: item.issuedFromStock || 0,
      issuedFromProduction: item.issuedFromProduction || 0,
      issuedQuantity: item.issuedQuantity || 0
    };
  });

  await Promise.all(
    updatedItems
      .filter((item) => item.productId && item.toProduce > 0)
      .map((item) =>
        ProductInventory.updateOne(
          { productId: item.productId },
          { $inc: { availableQuantity: item.toProduce }, $setOnInsert: { location: "FINISHED", reservedQuantity: 0 } },
          { upsert: true }
        )
      )
  );

  workOrder.items = updatedItems;
  workOrder.status = "completed";
  workOrder.completedAt = workOrder.completedAt || completedAt;
  workOrder.fulfillmentStatus = "awaiting_payment";
  await workOrder.save();

  await Order.findByIdAndUpdate(workOrder.orderId, {
    status: "completed",
    items: updatedItems.map(({ productId, productName, quantity, fromStock, toProduce }) => ({
      productId,
      productName,
      quantity,
      fromStock,
      toProduce
    }))
  });

  await ActivityLog.create({
    actor,
    action: "complete_work_order_for_payment",
    llmProvider,
    mcpTool: "complete_work_order_for_approval",
    input: rawInput || { workOrderId },
    output: {
      workOrderCode: workOrder.code,
      completedProducts: updatedItems.reduce((sum, item) => sum + item.toProduce, 0),
      reservedFromStock: updatedItems.reduce((sum, item) => sum + item.fromStock, 0)
    },
    durationMs: Date.now() - started
  });

  return workOrder;
}

export async function approveWorkOrderPayment(workOrderId, { actor = "system", llmProvider = "mock", rawInput } = {}) {
  const started = Date.now();
  let workOrder = await WorkOrder.findById(workOrderId);
  if (!workOrder) {
    throw new Error("Work order was not found.");
  }

  if (["sold", "issued"].includes(workOrder.fulfillmentStatus)) {
    return workOrder;
  }

  if (workOrder.fulfillmentStatus === "open") {
    workOrder = await completeWorkOrderForApproval(workOrderId, { actor, llmProvider, rawInput });
  }

  const soldAt = new Date();
  const updatedItems = workOrder.items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const fromStock = Number(item.fromStock) || 0;
    const toProduce = Number(item.toProduce ?? Math.max(0, quantity - fromStock)) || 0;

    return {
      productId: item.productId,
      productName: item.productName,
      quantity,
      fromStock,
      toProduce,
      issuedFromStock: fromStock,
      issuedFromProduction: toProduce,
      issuedQuantity: quantity
    };
  });

  await Promise.all(
    updatedItems
      .filter((item) => item.productId && item.issuedQuantity > 0)
      .map((item) =>
        ProductInventory.updateOne(
          { productId: item.productId },
          {
            $inc: {
              availableQuantity: -item.issuedQuantity,
              reservedQuantity: -item.issuedFromStock
            },
            $setOnInsert: { location: "FINISHED" }
          },
          { upsert: true }
        )
      )
  );

  workOrder.items = updatedItems;
  workOrder.status = "sold";
  workOrder.completedAt = workOrder.completedAt || soldAt;
  workOrder.issuedAt = soldAt;
  workOrder.fulfillmentStatus = "sold";
  await workOrder.save();

  await Order.findByIdAndUpdate(workOrder.orderId, {
    status: "sold",
    fulfilledAt: soldAt,
    items: updatedItems.map(({ productId, productName, quantity, fromStock, toProduce, issuedFromStock, issuedFromProduction, issuedQuantity }) => ({
      productId,
      productName,
      quantity,
      fromStock,
      toProduce,
      issuedFromStock,
      issuedFromProduction,
      issuedQuantity
    }))
  });

  await ActivityLog.create({
    actor,
    action: "approve_payment_and_sell",
    llmProvider,
    mcpTool: "approve_work_order_payment",
    input: rawInput || { workOrderId },
    output: {
      workOrderCode: workOrder.code,
      soldProducts: updatedItems.reduce((sum, item) => sum + item.issuedQuantity, 0),
      soldFromStock: updatedItems.reduce((sum, item) => sum + item.issuedFromStock, 0),
      soldFromProduction: updatedItems.reduce((sum, item) => sum + item.issuedFromProduction, 0)
    },
    durationMs: Date.now() - started
  });

  return workOrder;
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

    const employeeWorkloadMinutes = (employee) =>
      existingPhases
        .filter((phase) => String(phase.assignedTo) === String(employee._id))
        .reduce((sum, phase) => sum + Math.max(0, (new Date(phase.end).getTime() - new Date(phase.start).getTime()) / 60000), 0);
    const freeCandidates = candidates.filter((employee) =>
      availability.get(String(employee._id)).getTime() <= dependencyEnd.getTime()
    );
    const hasFreeCandidates = freeCandidates.length > 0;
    const candidatePool = hasFreeCandidates ? freeCandidates : candidates;
    const chosen = candidates
      .filter((employee) => candidatePool.some((candidate) => String(candidate._id) === String(employee._id)))
      .map((employee) => {
        const employeeStart = maxDate(availability.get(String(employee._id)), dependencyEnd);
        return { employee, start: employeeStart, workloadMinutes: employeeWorkloadMinutes(employee) };
      })
      .sort((a, b) => hasFreeCandidates
        ? a.workloadMinutes - b.workloadMinutes || a.employee.activePhaseCount - b.employee.activePhaseCount
        : a.workloadMinutes - b.workloadMinutes || a.start.getTime() - b.start.getTime() || a.employee.activePhaseCount - b.employee.activePhaseCount
      )[0];

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

export async function generateMissingWorkOrderPhases({ workOrderCode, actor = "admin", llmProvider = "mock", rawInput }) {
  const started = Date.now();
  const code = String(workOrderCode || "").trim().toUpperCase();
  const workOrder = await WorkOrder.findOne({ code }).populate("orderId");

  if (!workOrder) {
    const error = new Error(`Delovni nalog ${code || ""} ni najden.`);
    error.statusCode = 404;
    throw error;
  }

  const sourceItems = workOrder.items?.length ? workOrder.items : workOrder.orderId?.items || [];
  const cleanItems = sourceItems
    .map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: Number(item.toProduce) > 0 ? Number(item.toProduce) : Number(item.quantity)
    }))
    .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

  if (!cleanItems.length) {
    const output = {
      code: "NO_WORK_ORDER_PRODUCTS",
      message: `${workOrder.code} nima izdelkov, zato faz ni mogoce ustvariti.`
    };
    await ActivityLog.create({
      actor,
      action: "generate_work_order_phases",
      llmProvider,
      mcpTool: "generate_work_order_phases",
      input: rawInput || { workOrderCode },
      output,
      durationMs: Date.now() - started
    });
    return output;
  }

  const existingPhases = await WorkOrderPhase.find({ workOrderId: workOrder._id }).lean();
  const products = await Product.find({ _id: { $in: cleanItems.map((item) => item.productId) } })
    .populate("requiredParts.partId")
    .lean();
  const productById = new Map(products.map((product) => [String(product._id), product]));
  const createdPhases = [];
  const inventoryChecks = [];
  const partOrders = [];
  const updatedItems = [];

  for (const item of cleanItems) {
    const product = productById.get(String(item.productId));
    if (!product) continue;

    const missingPhaseTemplates = product.phases.filter((phase) =>
      !existingPhases.some((existing) =>
        String(existing.productId) === String(product._id) &&
        normalize(existing.name) === normalize(phase.name)
      )
    );
    if (!missingPhaseTemplates.length) {
      updatedItems.push(item);
      continue;
    }

    const previousItem = workOrder.items.find((candidate) => String(candidate.productId) === String(item.productId));
    const previousFromStock = Number(previousItem?.fromStock) || 0;
    await releaseReservedFinishedProducts(product._id, previousFromStock);

    const inventoryCheck = await checkInventoryForProduct(product, item.quantity);
    const partOrder = await autoOrderMissingParts(inventoryCheck);
    await reserveInventory(product, item.quantity);
    if (partOrder) {
      partOrder.workOrderId = workOrder._id;
      await partOrder.save();
      partOrders.push(partOrder);
    }
    inventoryChecks.push({ productId: product._id, productName: product.name, quantity: item.quantity, inventoryCheck });

    const phaseProduct = {
      ...product,
      phases: missingPhaseTemplates
    };
    const phases = await generateAndAssignPhases({
      workOrder,
      product: phaseProduct,
      quantity: item.quantity,
      startDate: new Date()
    });
    createdPhases.push(...phases);
    updatedItems.push({
      productId: product._id,
      productName: product.name,
      quantity: item.quantity,
      fromStock: 0,
      toProduce: item.quantity
    });
  }

  if (createdPhases.length > 0) {
    const itemByProductId = new Map(updatedItems.map((item) => [String(item.productId), item]));
    workOrder.items = sourceItems.map((item) => {
      const replacement = itemByProductId.get(String(item.productId));
      return replacement || item;
    });
    workOrder.status = "planned";
    workOrder.fulfillmentStatus = "open";
    workOrder.completedAt = undefined;
    workOrder.inventoryStatus = partOrders.length ? "replenished" : "available";
    await workOrder.save();

    await Order.findByIdAndUpdate(workOrder.orderId?._id || workOrder.orderId, {
      status: "in_production",
      items: workOrder.items.map(({ productId, productName, quantity, fromStock, toProduce }) => ({
        productId,
        productName,
        quantity,
        fromStock,
        toProduce
      }))
    });
  }

  const output = {
    workOrder,
    phases: createdPhases,
    inventoryCheck: inventoryChecks,
    partOrders,
    message: createdPhases.length
      ? `${workOrder.code}: ustvarjenih in dodeljenih ${createdPhases.length} faz.`
      : `${workOrder.code}: vse potrebne faze ze obstajajo.`
  };

  await ActivityLog.create({
    actor,
    action: "generate_work_order_phases",
    llmProvider,
    mcpTool: "generate_work_order_phases",
    input: rawInput || { workOrderCode },
    output: {
      workOrderCode: workOrder.code,
      phaseCount: createdPhases.length,
      itemCount: cleanItems.length,
      orderedParts: partOrders.flatMap((partOrder) => partOrder.parts || [])
    },
    durationMs: Date.now() - started
  });

  return output;
}

export async function processCustomerOrder({ customerName, productName, quantity, requestedDeadline, forceProduction = false, actor = "admin", llmProvider = "mock", rawInput }) {
  const started = Date.now();
  const product = await findProductByName(productName);

  if (!product) {
    throw new Error(`Product "${productName}" was not found.`);
  }

  const parsedQuantity = Number(quantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
    throw new Error("Quantity must be a positive number.");
  }

  const fromStock = forceProduction ? 0 : await reserveFinishedProducts(product, parsedQuantity);
  const toProduce = Math.max(0, parsedQuantity - fromStock);
  const firstCheck = toProduce > 0 ? await checkInventoryForProduct(product, toProduce) : [];
  const partOrder = await autoOrderMissingParts(firstCheck);
  const inventoryStatus = partOrder ? "replenished" : "available";
  const reservedParts = await reserveInventory(product, toProduce);

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
    reservedParts,
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
  if (toProduce === 0) {
    await completeWorkOrderForApproval(workOrder._id, {
      actor,
      llmProvider,
      rawInput: { source: "finished_stock", customerName, productName, quantity, requestedDeadline, forceProduction }
    });
  }
  const output = {
    workOrder: toProduce === 0 ? await WorkOrder.findById(workOrder._id).lean() : workOrder,
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

export async function createWorkOrderOnly({ customerName, productName, quantity, requestedDeadline, actor = "admin", llmProvider = "mock", rawInput }) {
  const started = Date.now();
  const product = await findProductByName(productName);

  if (!product) {
    throw new Error(`Product "${productName}" was not found.`);
  }

  const parsedQuantity = Number(quantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
    throw new Error("Quantity must be a positive number.");
  }

  const order = await Order.create({
    customerName: customerName || "Unknown customer",
    items: [{ productId: product._id, productName: product.name, quantity: parsedQuantity }],
    requestedDeadline
  });

  const startDate = new Date();
  const workOrder = await WorkOrder.create({
    code: await nextWorkOrderCode(),
    orderId: order._id,
    items: [{
      productId: product._id,
      productName: product.name,
      quantity: parsedQuantity,
      fromStock: 0,
      toProduce: parsedQuantity
    }],
    status: "planned",
    startDate,
    dueDate: requestedDeadline ? new Date(requestedDeadline) : new Date(Date.now() + 7 * DAY_MS),
    inventoryStatus: "available"
  });

  const output = {
    workOrder,
    phases: [],
    message: `${workOrder.code} created for ${parsedQuantity} x ${product.name}. Automatic inventory checks and phase assignment were skipped.`
  };

  await ActivityLog.create({
    actor,
    action: "create_work_order_only",
    llmProvider,
    mcpTool: "create_work_order_only",
    input: rawInput || { customerName, productName, quantity, requestedDeadline, forceProduction },
    output: {
      workOrderCode: workOrder.code,
      phaseCount: 0,
      inventoryStatus: "not_checked"
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
  const allReservedParts = [];
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
    const itemReservedParts = await reserveInventory(product, toProduce);
    allReservedParts.push(...itemReservedParts);

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
    reservedParts: allReservedParts,
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

  if (totalToProduce === 0) {
    await completeWorkOrderForApproval(workOrder._id, {
      actor,
      llmProvider,
      rawInput: { source: "finished_stock", customerName, items: cleanItems, requestedDeadline }
    });
  }

  const output = {
    workOrder: totalToProduce === 0 ? await WorkOrder.findById(workOrder._id).lean() : workOrder,
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

export async function processExistingOrder({ orderId, actor = "admin", llmProvider = "mock", rawInput }) {
  const started = Date.now();
  const order = await Order.findById(orderId).lean();

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  const existingWorkOrder = await WorkOrder.exists({ orderId: order._id });
  if (existingWorkOrder) {
    const error = new Error("To narocilo ze ima povezan delovni nalog.");
    error.statusCode = 409;
    throw error;
  }

  const cleanItems = (order.items || [])
    .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }))
    .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

  if (!cleanItems.length) {
    const error = new Error("Order does not contain valid product items.");
    error.statusCode = 400;
    throw error;
  }

  const products = await Product.find({ _id: { $in: cleanItems.map((item) => item.productId) } })
    .populate("requiredParts.partId")
    .lean();
  const productById = new Map(products.map((product) => [String(product._id), product]));
  const orderItems = [];
  const workOrderItems = [];
  const inventoryChecks = [];
  const partOrders = [];
  const allReservedParts = [];
  let totalToProduce = 0;
  let totalFromStock = 0;

  for (const item of cleanItems) {
    const product = productById.get(String(item.productId));
    if (!product) {
      const error = new Error(`Product "${item.productId}" was not found.`);
      error.statusCode = 404;
      throw error;
    }

    const fromStock = await reserveFinishedProducts(product, item.quantity);
    const toProduce = Math.max(0, item.quantity - fromStock);
    totalFromStock += fromStock;
    totalToProduce += toProduce;
    const inventoryCheck = toProduce > 0 ? await checkInventoryForProduct(product, toProduce) : [];
    const partOrder = await autoOrderMissingParts(inventoryCheck);
    const itemReservedParts = await reserveInventory(product, toProduce);
    allReservedParts.push(...itemReservedParts);

    orderItems.push({ productId: product._id, productName: product.name, quantity: item.quantity, fromStock, toProduce });
    workOrderItems.push({ productId: product._id, productName: product.name, quantity: item.quantity, fromStock, toProduce });
    inventoryChecks.push({ productId: product._id, productName: product.name, quantity: item.quantity, inventoryCheck });
    if (partOrder) partOrders.push(partOrder);
  }

  const startDate = new Date();
  const inventoryStatus = partOrders.length ? "replenished" : "available";
  const workOrder = await WorkOrder.create({
    code: await nextWorkOrderCode(),
    orderId: order._id,
    items: workOrderItems,
    reservedParts: allReservedParts,
    status: totalToProduce > 0 ? "planned" : "completed",
    startDate,
    dueDate: order.requestedDeadline ? new Date(order.requestedDeadline) : new Date(Date.now() + 7 * DAY_MS),
    inventoryStatus
  });

  await Order.findByIdAndUpdate(order._id, {
    items: orderItems,
    status: totalToProduce > 0 ? "in_production" : "completed"
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

  if (totalToProduce === 0) {
    await completeWorkOrderForApproval(workOrder._id, {
      actor,
      llmProvider,
      rawInput: rawInput || { source: "convert_existing_order", orderId }
    });
  }

  const output = {
    workOrder: totalToProduce === 0 ? await WorkOrder.findById(workOrder._id).lean() : workOrder,
    phases,
    inventoryCheck: inventoryChecks,
    partOrders,
    message: `${workOrder.code} created from existing order for ${orderItems.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}. ${totalFromStock} from finished stock, ${totalToProduce} to produce. Inventory was ${inventoryStatus}.`
  };

  await ActivityLog.create({
    actor,
    action: "convert_order_to_work_order",
    llmProvider,
    mcpTool: "process_existing_order",
    input: rawInput || { orderId },
    output: {
      orderId: order._id,
      workOrderCode: workOrder.code,
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
  const wantsBasicWorkOrder = normalized.includes("samo") && normalized.includes("delovni nalog");
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

  if (wantsBasicWorkOrder) {
    return {
      intent: "create_work_order_only",
      args: {
        customerName: customerMatch?.[1] || "AluTech",
        productName: product.name,
        quantity: Number(quantityMatch[1]),
        requestedDeadline: deadline
      }
    };
  }

  if (wantsWorkOrder) {
    return {
      intent: "process_work_order",
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
      intent: "check_product_availability",
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
