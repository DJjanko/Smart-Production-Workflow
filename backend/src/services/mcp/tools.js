import { ActivityLog } from "../../models/ActivityLog.js";
import { Employee } from "../../models/Employee.js";
import { Inventory } from "../../models/Inventory.js";
import { Order } from "../../models/Order.js";
import { Part } from "../../models/Part.js";
import { Product } from "../../models/Product.js";
import { ProductInventory } from "../../models/ProductInventory.js";
import { WorkOrder } from "../../models/WorkOrder.js";
import { WorkOrderPhase } from "../../models/WorkOrderPhase.js";
import {
  checkInventoryForProduct,
  createWorkOrderOnly,
  findProductByName,
  generateMissingWorkOrderPhases,
  processCustomerOrder
} from "../workflowService.js";

export const MCP_TOOLS = [
  {
    name: "check_product_availability",
    category: "information",
    description: "Checks required parts for a product and quantity."
  },
  {
    name: "get_employee_workload",
    category: "information",
    description: "Returns active workload by employee."
  },
  {
    name: "summarize_work_order",
    category: "information",
    description: "Summarizes a work order and its phases."
  },
  {
    name: "generate_work_order_phases",
    category: "workflow",
    description: "Creates missing phases for an existing work order and assigns them to suitable employees."
  },
  {
    name: "process_work_order",
    category: "workflow",
    description: "Creates an order and work order, checks inventory, orders missing parts, reserves inventory, generates phases, and assigns employees."
  },
  {
    name: "create_work_order_only",
    category: "workflow",
    description: "Creates only the base order and work order records without inventory checks or phase assignment."
  },
  {
    name: "get_parts",
    category: "crud_information",
    description: "Lists or searches spare parts."
  },
  {
    name: "create_part",
    category: "crud_mutation",
    description: "Creates a spare part after confirmation."
  },
  {
    name: "update_part",
    category: "crud_mutation",
    description: "Updates a spare part after confirmation."
  },
  {
    name: "delete_part",
    category: "crud_mutation",
    description: "Deletes a spare part after confirmation."
  },
  {
    name: "get_employees",
    category: "crud_information",
    description: "Lists or searches employees."
  },
  {
    name: "create_employee",
    category: "crud_mutation",
    description: "Creates an employee after confirmation."
  },
  {
    name: "update_employee",
    category: "crud_mutation",
    description: "Updates an employee after confirmation."
  },
  {
    name: "delete_employee",
    category: "crud_mutation",
    description: "Deletes an employee after confirmation."
  },
  {
    name: "get_products",
    category: "crud_information",
    description: "Lists or searches products."
  },
  {
    name: "create_product",
    category: "crud_mutation",
    description: "Creates a product after confirmation."
  },
  {
    name: "update_product",
    category: "crud_mutation",
    description: "Updates a product after confirmation."
  },
  {
    name: "delete_product",
    category: "crud_mutation",
    description: "Deletes a product after confirmation."
  },
  {
    name: "get_orders",
    category: "crud_information",
    description: "Lists or searches customer orders."
  },
  {
    name: "create_order",
    category: "crud_mutation",
    description: "Creates a customer order after confirmation."
  },
  {
    name: "update_order",
    category: "crud_mutation",
    description: "Updates a customer order after confirmation."
  },
  {
    name: "delete_order",
    category: "crud_mutation",
    description: "Deletes a customer order after confirmation."
  },
  {
    name: "get_work_orders",
    category: "crud_information",
    description: "Lists or searches work orders."
  },
  {
    name: "create_work_order_record",
    category: "crud_mutation",
    description: "Creates a basic work order record after confirmation."
  },
  {
    name: "update_work_order",
    category: "crud_mutation",
    description: "Updates a work order after confirmation."
  },
  {
    name: "delete_work_order",
    category: "crud_mutation",
    description: "Deletes a work order and phases after confirmation."
  },
  {
    name: "get_work_order_phases",
    category: "crud_information",
    description: "Lists or searches work order phases."
  },
  {
    name: "create_work_order_phase",
    category: "crud_mutation",
    description: "Creates a work order phase after confirmation."
  },
  {
    name: "update_work_order_phase",
    category: "crud_mutation",
    description: "Updates a work order phase after confirmation."
  },
  {
    name: "delete_work_order_phase",
    category: "crud_mutation",
    description: "Deletes a work order phase after confirmation."
  }
];

const CRUD_ENTITY_CONFIG = {
  part: {
    model: Part,
    plural: "parts",
    label: "rezervni del",
    searchFields: ["name", "sku", "unit"],
    sort: { name: 1 },
    populate: null,
    pickData: (data = {}) => cleanObject({
      name: data.name,
      sku: data.sku,
      unit: data.unit,
      minStock: data.minStock === undefined ? undefined : Number(data.minStock)
    }),
    findOne: (args = {}) => ({
      ...(args.id || args.entityId ? { _id: args.id || args.entityId } : {}),
      ...(args.sku ? { sku: args.sku } : {}),
      ...(args.name ? { name: new RegExp(`^${escapeRegExp(args.name)}$`, "i") } : {})
    })
  },
  employee: {
    model: Employee,
    plural: "employees",
    label: "zaposleni",
    searchFields: ["name", "skills"],
    sort: { name: 1 },
    populate: null,
    pickData: (data = {}) => cleanObject({
      name: data.name,
      skills: Array.isArray(data.skills) ? data.skills.map((skill) => String(skill).toLowerCase().trim()).filter(Boolean) : undefined,
      workingHoursPerDay: data.workingHoursPerDay === undefined ? undefined : Number(data.workingHoursPerDay)
    }),
    findOne: (args = {}) => ({
      ...(args.id || args.entityId ? { _id: args.id || args.entityId } : {}),
      ...(args.name ? { name: new RegExp(`^${escapeRegExp(args.name)}$`, "i") } : {})
    })
  },
  product: {
    model: Product,
    plural: "products",
    label: "izdelek",
    searchFields: ["name", "description"],
    sort: { name: 1 },
    populate: "requiredParts.partId",
    pickData: (data = {}) => cleanObject({
      name: data.name,
      description: data.description,
      requiredParts: Array.isArray(data.requiredParts) ? data.requiredParts : undefined,
      phases: Array.isArray(data.phases) ? data.phases : undefined
    }),
    findOne: (args = {}) => ({
      ...(args.id || args.entityId ? { _id: args.id || args.entityId } : {}),
      ...(args.name || args.productName ? { name: new RegExp(`^${escapeRegExp(args.name || args.productName)}$`, "i") } : {})
    })
  },
  order: {
    model: Order,
    plural: "orders",
    label: "narocilo",
    searchFields: ["customerName", "status", "items.productName"],
    sort: { createdAt: -1 },
    populate: "items.productId",
    pickData: (data = {}) => cleanObject({
      customerName: data.customerName,
      items: Array.isArray(data.items) ? data.items : undefined,
      requestedDeadline: data.requestedDeadline,
      status: data.status
    }),
    findOne: (args = {}) => ({
      ...(args.id || args.entityId ? { _id: args.id || args.entityId } : {}),
      ...(args.customerName ? { customerName: new RegExp(`^${escapeRegExp(args.customerName)}$`, "i") } : {})
    })
  },
  work_order: {
    model: WorkOrder,
    plural: "work_orders",
    label: "delovni nalog",
    searchFields: ["code", "status", "inventoryStatus", "fulfillmentStatus", "items.productName"],
    sort: { createdAt: -1 },
    populate: "orderId",
    pickData: (data = {}) => cleanObject({
      status: data.status,
      startDate: data.startDate,
      dueDate: data.dueDate,
      inventoryStatus: data.inventoryStatus,
      fulfillmentStatus: data.fulfillmentStatus,
      items: Array.isArray(data.items) ? data.items : undefined
    }),
    findOne: (args = {}) => ({
      ...(args.id || args.entityId ? { _id: args.id || args.entityId } : {}),
      ...(args.code || args.workOrderCode ? { code: serializeWorkOrderCode(args.code || args.workOrderCode) } : {})
    })
  },
  work_order_phase: {
    model: WorkOrderPhase,
    plural: "work_order_phases",
    label: "faza delovnega naloga",
    searchFields: ["name", "requiredSkill", "assignedToName", "status"],
    sort: { start: 1 },
    populate: "workOrderId",
    pickData: (data = {}) => cleanObject({
      workOrderId: data.workOrderId,
      productId: data.productId,
      name: data.name,
      requiredSkill: data.requiredSkill,
      assignedTo: data.assignedTo,
      assignedToName: data.assignedToName,
      start: data.start,
      end: data.end,
      dependsOn: Array.isArray(data.dependsOn) ? data.dependsOn : undefined,
      status: data.status
    }),
    findOne: (args = {}) => ({
      ...(args.id || args.entityId ? { _id: args.id || args.entityId } : {})
    })
  }
};

const CRUD_TOOL_MAP = {
  get_parts: { action: "get", entity: "part" },
  create_part: { action: "create", entity: "part" },
  update_part: { action: "update", entity: "part" },
  delete_part: { action: "delete", entity: "part" },
  get_employees: { action: "get", entity: "employee" },
  create_employee: { action: "create", entity: "employee" },
  update_employee: { action: "update", entity: "employee" },
  delete_employee: { action: "delete", entity: "employee" },
  get_products: { action: "get", entity: "product" },
  create_product: { action: "create", entity: "product" },
  update_product: { action: "update", entity: "product" },
  delete_product: { action: "delete", entity: "product" },
  get_orders: { action: "get", entity: "order" },
  create_order: { action: "create", entity: "order" },
  update_order: { action: "update", entity: "order" },
  delete_order: { action: "delete", entity: "order" },
  get_work_orders: { action: "get", entity: "work_order" },
  create_work_order_record: { action: "create", entity: "work_order" },
  update_work_order: { action: "update", entity: "work_order" },
  delete_work_order: { action: "delete", entity: "work_order" },
  get_work_order_phases: { action: "get", entity: "work_order_phase" },
  create_work_order_phase: { action: "create", entity: "work_order_phase" },
  update_work_order_phase: { action: "update", entity: "work_order_phase" },
  delete_work_order_phase: { action: "delete", entity: "work_order_phase" }
};

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializeWorkOrderCode(value = "") {
  const match = String(value).toUpperCase().match(/WO-\d+/);
  return match?.[0] || String(value).trim().toUpperCase();
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hasConfirmation(args = {}) {
  return args.confirmed === true || args.confirmed === "true";
}

function cleanObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([_key, fieldValue]) => fieldValue !== undefined));
}

function formatActionName(action) {
  return {
    create: "ustvaril",
    update: "posodobil",
    delete: "izbrisal"
  }[action] || "izvedel";
}

function describeTarget(entity, data = {}, args = {}, action = "") {
  if (entity === "part") {
    const name = data.name || args.name || "rezervni del";
    const availableQuantity = action === "delete" ? undefined : data.availableQuantity ?? args.availableQuantity ?? args.quantity;
    const details = [
      data.sku || args.sku ? `SKU ${data.sku || args.sku}` : null,
      data.unit ? `enota ${data.unit}` : null,
      data.minStock !== undefined ? `minimalna zaloga ${data.minStock}` : null,
      availableQuantity !== undefined ? `${action === "create" ? "zacetna zaloga" : "zaloga na voljo"} ${availableQuantity}` : null
    ].filter(Boolean);
    return `${name}${details.length ? ` (${details.join(", ")})` : ""}`;
  }

  if (entity === "product") {
    const details = [];
    const availableQuantity = data.availableQuantity ?? args.availableQuantity ?? args.quantity;
    if (availableQuantity !== undefined && action !== "delete") {
      details.push(`zaloga na voljo ${availableQuantity}`);
    }
    if (data.addRequiredPart) {
      details.push(`dodam del ${data.addRequiredPart.partName || data.addRequiredPart.sku || "material"} x ${data.addRequiredPart.quantity || "?"}`);
    }
    if (data.addPhase) {
      const skillText = data.addPhase.requiredSkill ? `, znanje ${data.addPhase.requiredSkill}` : "";
      details.push(`dodam ali posodobim fazo ${data.addPhase.name || "faza"} (${data.addPhase.durationMinutes || "?"} min${skillText})`);
    }
    const target = data.name || args.productName || args.name || "izdelek";
    return details.length ? `${target}; ${details.join("; ")}` : target;
  }

  if (entity === "employee") {
    const skills = Array.isArray(data.skills) ? data.skills.join(", ") : null;
    const details = [
      skills ? `znanja ${skills}` : null,
      data.addSkill ? `dodam znanje ${data.addSkill}` : null,
      data.removeSkill ? `odstranim znanje ${data.removeSkill}` : null,
      data.workingHoursPerDay !== undefined ? `ure na dan ${data.workingHoursPerDay}` : null,
      data.name && args.name && data.name !== args.name ? `novo ime ${data.name}` : null
    ].filter(Boolean);

    return `${args.name || data.name || "zaposlenega"}${details.length ? ` (${details.join(", ")})` : ""}`;
  }

  if (entity === "order") {
    const product = args.productName || data.items?.[0]?.productName || "izdelek";
    const quantity = args.quantity || data.items?.[0]?.quantity;
    const customer = args.customerName || data.customerName || "stranko";
    return quantity ? `${quantity} x ${product} za ${customer}` : `narocilo za ${customer}`;
  }

  if (entity === "work_order") {
    const product = args.productName || data.items?.[0]?.productName || args.code || args.workOrderCode || "delovni nalog";
    const quantity = args.quantity || data.items?.[0]?.quantity;
    const details = [
      data.status ? `status ${data.status}` : null,
      data.inventoryStatus ? `zaloga ${data.inventoryStatus}` : null,
      data.dueDate ? `rok ${data.dueDate}` : null
    ].filter(Boolean);
    const target = quantity ? `${quantity} x ${product}` : product;
    return details.length ? `${target} (${details.join(", ")})` : target;
  }

  if (entity === "work_order_phase") {
    return data.name || args.name || "fazo delovnega naloga";
  }

  return data.name || args.name || args.code || args.sku || "zapis";
}

function buildConfirmationMessage({ action, entity, config, data, args }) {
  const verb = formatActionName(action);
  const target = describeTarget(entity, data, args, action);

  return `Po potrditvi bom ${verb} ${config.label}: ${target}.`;
}

function buildCrudSearchQuery(config, args = {}) {
  const filters = [];
  const search = args.search || args.query || args.name || args.code || args.sku || "";

  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    filters.push({ $or: config.searchFields.map((field) => ({ [field]: regex })) });
  }
  if (args.status) filters.push({ status: args.status });
  if (args.id || args.entityId) filters.push({ _id: args.id || args.entityId });

  return filters.length ? { $and: filters } : {};
}

function maybePopulate(query, populate) {
  return populate ? query.populate(populate) : query;
}

async function enrichCrudRows(entity, rows) {
  if (entity === "product") {
    const inventories = await ProductInventory.find({ productId: { $in: rows.map((row) => row._id) } }).lean();
    const inventoryByProduct = new Map(inventories.map((inventory) => [String(inventory.productId), inventory]));

    return rows.map((row) => {
      const inventory = inventoryByProduct.get(String(row._id));
      const availableQuantity = inventory?.availableQuantity || 0;
      const reservedQuantity = inventory?.reservedQuantity || 0;

      return {
        ...row,
        availableQuantity,
        reservedQuantity,
        usableQuantity: Math.max(0, availableQuantity - reservedQuantity),
        location: inventory?.location || null,
        inventory: inventory
          ? {
              id: inventory._id,
              availableQuantity,
              reservedQuantity,
              usableQuantity: Math.max(0, availableQuantity - reservedQuantity),
              location: inventory.location
            }
          : null
      };
    });
  }

  if (entity !== "part") return rows;

  const inventories = await Inventory.find({ partId: { $in: rows.map((row) => row._id) } }).lean();
  const inventoryByPart = new Map(inventories.map((inventory) => [String(inventory.partId), inventory]));

  return rows.map((row) => {
    const inventory = inventoryByPart.get(String(row._id));
    const availableQuantity = inventory?.availableQuantity || 0;
    const reservedQuantity = inventory?.reservedQuantity || 0;

    return {
      ...row,
      availableQuantity,
      reservedQuantity,
      usableQuantity: Math.max(0, availableQuantity - reservedQuantity),
      location: inventory?.location || null,
      inventory: inventory
        ? {
            id: inventory._id,
            availableQuantity,
            reservedQuantity,
            usableQuantity: Math.max(0, availableQuantity - reservedQuantity),
            location: inventory.location
          }
        : null
    };
  });
}

function buildCrudGetMessage(entity, config, rows) {
  if (entity === "product") {
    if (!rows.length) return "Ni najdenih izdelkov.";

    const preview = rows
      .slice(0, 8)
      .map((product) => `${product.name}: ${product.availableQuantity} kos na zalogi, ${product.usableQuantity} uporabno`)
      .join("; ");
    const suffix = rows.length > 8 ? `; in se ${rows.length - 8} zapisov` : "";

    return `Najdenih ${rows.length} izdelkov: ${preview}${suffix}.`;
  }

  if (entity === "part") {
    if (!rows.length) return "Ni najdenih rezervnih delov.";

    const preview = rows
      .slice(0, 8)
      .map((part) => `${part.name} (${part.sku}): ${part.availableQuantity} ${part.unit || "pcs"} na zalogi, ${part.usableQuantity} uporabno`)
      .join("; ");
    const suffix = rows.length > 8 ? `; in se ${rows.length - 8} zapisov` : "";

    return `Najdenih ${rows.length} rezervnih delov: ${preview}${suffix}.`;
  }

  return `Najdenih ${rows.length} zapisov za ${config.label}.`;
}

async function logMcpCall({ actor, provider, toolName, input, output, started }) {
  await ActivityLog.create({
    actor,
    action: toolName,
    llmProvider: provider,
    mcpTool: toolName,
    input,
    output,
    durationMs: Date.now() - started
  });
}

function summarizeCrudLogItem(item = {}) {
  return cleanObject({
    id: item._id || item.id,
    name: item.name,
    code: item.code,
    sku: item.sku,
    customerName: item.customerName,
    status: item.status,
    inventoryStatus: item.inventoryStatus,
    fulfillmentStatus: item.fulfillmentStatus,
    requestedDeadline: item.requestedDeadline,
    dueDate: item.dueDate,
    unit: item.unit,
    availableQuantity: item.availableQuantity,
    reservedQuantity: item.reservedQuantity,
    usableQuantity: item.usableQuantity,
    location: item.location,
    minStock: item.minStock,
    skills: item.skills,
    workingHoursPerDay: item.workingHoursPerDay,
    requiredSkill: item.requiredSkill,
    durationMinutes: item.durationMinutes,
    assignedToName: item.assignedToName,
    items: Array.isArray(item.items)
      ? item.items.map((orderItem) => cleanObject({
          productName: orderItem.productName || orderItem.productId?.name,
          quantity: orderItem.quantity,
          fromStock: orderItem.fromStock,
          toProduce: orderItem.toProduce,
          issuedQuantity: orderItem.issuedQuantity
        }))
      : undefined
  });
}

async function checkProductAvailability({ args, actor, provider, rawInput, started }) {
  const product = await findProductByName(args.productName);
  if (!product) {
    const output = { code: "PRODUCT_NOT_FOUND", message: `Izdelka "${args.productName}" nisem nasel.` };
    await logMcpCall({ actor, provider, toolName: "check_product_availability", input: rawInput, output, started });
    return { statusCode: 404, result: output };
  }

  const quantity = Number(args.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) {
    const output = { code: "MISSING_REQUIRED_FIELDS", missingFields: ["quantity"], message: "Potrebujem se kolicino izdelkov." };
    await logMcpCall({ actor, provider, toolName: "check_product_availability", input: rawInput, output, started });
    return { statusCode: 400, result: output };
  }

  const inventoryCheck = await checkInventoryForProduct(product, quantity);
  const missingParts = inventoryCheck.filter((item) => item.missingQuantity > 0);
  const output = {
    product,
    quantity,
    inventoryCheck,
    missingParts,
    message: missingParts.length
      ? `Za ${quantity} x ${product.name} manjka ${missingParts.length} vrst delov.`
      : `Za ${quantity} x ${product.name} imamo dovolj delov.`
  };

  await logMcpCall({
    actor,
    provider,
    toolName: "check_product_availability",
    input: rawInput,
    output: { productName: product.name, quantity, missingPartCount: missingParts.length },
    started
  });

  return { statusCode: 200, result: output };
}

async function getEmployeeWorkload({ actor, provider, rawInput, started }) {
  const [employees, phases] = await Promise.all([
    Employee.find().sort({ name: 1 }).lean(),
    WorkOrderPhase.find({ status: { $ne: "completed" } }).lean()
  ]);

  const workload = employees.map((employee) => {
    const assigned = phases.filter((phase) => String(phase.assignedTo) === String(employee._id));
    const minutes = assigned.reduce((sum, phase) => sum + Math.max(0, (new Date(phase.end) - new Date(phase.start)) / 60000), 0);
    return {
      employeeId: employee._id,
      name: employee.name,
      skills: employee.skills,
      activePhaseCount: assigned.length,
      hours: Math.round((minutes / 60) * 10) / 10
    };
  });

  const busiest = [...workload].sort((a, b) => b.hours - a.hours || b.activePhaseCount - a.activePhaseCount)[0] || null;
  const output = {
    workload,
    busiest,
    message: busiest ? `Najbolj zaseden je ${busiest.name} (${busiest.hours} h, ${busiest.activePhaseCount} faz).` : "Ni aktivnih zaposlenih."
  };

  await logMcpCall({
    actor,
    provider,
    toolName: "get_employee_workload",
    input: rawInput,
    output: { employeeCount: workload.length, busiest: busiest?.name },
    started
  });

  return { statusCode: 200, result: output };
}

async function summarizeWorkOrder({ args, actor, provider, rawInput, started }) {
  const code = serializeWorkOrderCode(args.workOrderCode || args.code);
  const workOrder = await WorkOrder.findOne({ code }).populate("orderId").lean();

  if (!workOrder) {
    const output = { code: "WORK_ORDER_NOT_FOUND", message: `Delovnega naloga ${code} nisem nasel.` };
    await logMcpCall({ actor, provider, toolName: "summarize_work_order", input: rawInput, output, started });
    return { statusCode: 404, result: output };
  }

  const phases = await WorkOrderPhase.find({ workOrderId: workOrder._id }).sort({ start: 1 }).lean();
  const phaseStatusCounts = phases.reduce((counts, phase) => {
    counts[phase.status] = (counts[phase.status] || 0) + 1;
    return counts;
  }, {});
  const output = {
    workOrder,
    phases,
    phaseStatusCounts,
    message: `${workOrder.code}: ${workOrder.status}, ${phases.length} faz, rok ${workOrder.dueDate ? new Date(workOrder.dueDate).toLocaleDateString("sl-SI") : "ni nastavljen"}.`
  };

  await logMcpCall({
    actor,
    provider,
    toolName: "summarize_work_order",
    input: rawInput,
    output: { workOrderCode: workOrder.code, phaseCount: phases.length, status: workOrder.status },
    started
  });

  return { statusCode: 200, result: output };
}

async function generateWorkOrderPhases({ args, actor, provider, rawInput, started }) {
  try {
    const output = await generateMissingWorkOrderPhases({
      workOrderCode: args.workOrderCode || args.code,
      actor,
      llmProvider: provider,
      rawInput
    });

    return { statusCode: output.code ? 400 : 200, result: output };
  } catch (error) {
    const output = {
      code: error.statusCode === 404 ? "NOT_FOUND" : "PHASE_GENERATION_FAILED",
      message: error.message
    };
    await logMcpCall({ actor, provider, toolName: "generate_work_order_phases", input: rawInput, output, started });
    return { statusCode: error.statusCode || 400, result: output };
  }
}

async function processWorkOrder({ args, actor, provider, rawInput }) {
  const result = await processCustomerOrder({
    ...args,
    actor,
    llmProvider: provider,
    rawInput
  });

  return { statusCode: 201, result };
}

async function createBasicWorkOrder({ args, actor, provider, rawInput }) {
  const result = await createWorkOrderOnly({
    ...args,
    actor,
    llmProvider: provider,
    rawInput
  });

  return { statusCode: 201, result };
}

async function createCrudWorkOrder({ args, actor, provider, rawInput }) {
  if (args.productName && args.quantity) {
    const result = await createWorkOrderOnly({
      customerName: args.customerName || args.data?.customerName || "AluTech",
      productName: args.productName,
      quantity: args.quantity,
      requestedDeadline: args.requestedDeadline || args.data?.requestedDeadline,
      actor,
      llmProvider: provider,
      rawInput
    });
    return result.workOrder;
  }

  const count = await WorkOrder.countDocuments();
  return WorkOrder.create({
    code: args.data?.code || `WO-${String(count + 1).padStart(3, "0")}`,
    orderId: args.data?.orderId,
    items: Array.isArray(args.data?.items) ? args.data.items : [],
    status: args.data?.status || "planned",
    startDate: args.data?.startDate || new Date(),
    dueDate: args.data?.dueDate,
    inventoryStatus: args.data?.inventoryStatus || "available"
  });
}

async function createCrudOrder(args = {}) {
  if (args.productName && args.quantity) {
    const product = await findProductByName(args.productName);
    if (!product) {
      const error = new Error(`Izdelka "${args.productName}" nisem nasel.`);
      error.statusCode = 404;
      throw error;
    }

    return Order.create({
      customerName: args.customerName || args.data?.customerName || "AluTech",
      items: [{
        productId: product._id,
        productName: product.name,
        quantity: Number(args.quantity)
      }],
      requestedDeadline: args.requestedDeadline || args.data?.requestedDeadline || null,
      status: args.status || args.data?.status || "draft"
    });
  }

  const payload = cleanObject(CRUD_ENTITY_CONFIG.order.pickData({ ...args, ...(args.data || {}) }));
  return Order.create(payload);
}

async function findPartForProductUpdate(addRequiredPart = {}) {
  const filters = [];

  if (addRequiredPart.sku) {
    filters.push({ sku: new RegExp(`^${escapeRegExp(addRequiredPart.sku)}$`, "i") });
  }
  if (addRequiredPart.partName || addRequiredPart.name) {
    filters.push({ name: new RegExp(`^${escapeRegExp(addRequiredPart.partName || addRequiredPart.name)}$`, "i") });
  }

  if (!filters.length) return null;
  return Part.findOne({ $or: filters });
}

async function updateCrudProduct({ config, args, data }) {
  const targetQuery = config.findOne(args);
  if (Object.keys(targetQuery).length === 0) {
    return {
      statusCode: 400,
      result: {
        code: "MISSING_TARGET",
        message: "Za urejanje izdelka potrebujem ime izdelka ali id."
      }
    };
  }

  const product = await Product.findOne(targetQuery);
  if (!product) {
    return {
      statusCode: 404,
      result: {
        code: "NOT_FOUND",
        message: `Izdelka ${args.name || args.productName || args.id || ""} nisem nasel.`
      }
    };
  }

  const directPayload = cleanObject(config.pickData(data));
  if (directPayload.name !== undefined) product.name = directPayload.name;
  if (directPayload.description !== undefined) product.description = directPayload.description;
  if (directPayload.requiredParts !== undefined) product.requiredParts = directPayload.requiredParts;
  if (directPayload.phases !== undefined) product.phases = directPayload.phases;

  let updatedInventory = null;
  if (
    data.availableQuantity !== undefined ||
    data.reservedQuantity !== undefined ||
    data.location !== undefined ||
    data.quantity !== undefined
  ) {
    const inventoryPayload = cleanObject({
      availableQuantity: data.availableQuantity !== undefined
        ? Number(data.availableQuantity) || 0
        : data.quantity !== undefined
          ? Number(data.quantity) || 0
          : undefined,
      reservedQuantity: data.reservedQuantity === undefined ? undefined : Number(data.reservedQuantity) || 0,
      location: data.location
    });

    updatedInventory = await ProductInventory.findOneAndUpdate(
      { productId: product._id },
      {
        $set: inventoryPayload,
        $setOnInsert: {
          productId: product._id
        }
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();
  }

  if (data.addRequiredPart) {
    const part = await findPartForProductUpdate(data.addRequiredPart);
    if (!part) {
      return {
        statusCode: 404,
        result: {
          code: "PART_NOT_FOUND",
          message: `Rezervnega dela ${data.addRequiredPart.sku || data.addRequiredPart.partName || ""} nisem nasel. Najprej ga dodajte med rezervne dele.`
        }
      };
    }

    const quantity = Number(data.addRequiredPart.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return {
        statusCode: 400,
        result: {
          code: "MISSING_REQUIRED_FIELDS",
          message: "Za dodajanje dela v izdelek potrebujem kolicino dela."
        }
      };
    }

    const existingPart = product.requiredParts.find((requiredPart) => String(requiredPart.partId) === String(part._id));
    if (existingPart) {
      existingPart.quantity = quantity;
    } else {
      product.requiredParts.push({ partId: part._id, quantity });
    }
  }

  if (data.addPhase) {
    const existingPhaseIndex = product.phases.findIndex((existingPhase) => normalizeText(existingPhase.name) === normalizeText(data.addPhase.name));
    const existingPhase = existingPhaseIndex >= 0 ? product.phases[existingPhaseIndex] : null;
    const phase = {
      name: data.addPhase.name,
      requiredSkill: data.addPhase.requiredSkill || existingPhase?.requiredSkill,
      durationMinutes: Number(data.addPhase.durationMinutes),
      dependsOn: Array.isArray(data.addPhase.dependsOn) ? data.addPhase.dependsOn : existingPhase?.dependsOn || []
    };

    if (!phase.name || !phase.requiredSkill || !Number.isFinite(phase.durationMinutes) || phase.durationMinutes < 1) {
      return {
        statusCode: 400,
        result: {
          code: "MISSING_REQUIRED_FIELDS",
          message: "Za dodajanje faze potrebujem ime faze, znanje in trajanje v minutah."
        }
      };
    }

    if (existingPhaseIndex >= 0) {
      product.phases[existingPhaseIndex] = phase;
    } else {
      product.phases.push(phase);
    }
  }

  await product.save();
  return {
    statusCode: 200,
    result: {
      item: await Product.findById(product._id).populate("requiredParts.partId").lean(),
      ...(updatedInventory ? { inventory: updatedInventory } : {}),
      message: `Posodobljen izdelek ${product.name}.`
    }
  };
}

async function updateCrudEmployee({ config, args, data }) {
  const targetQuery = config.findOne(args);
  if (Object.keys(targetQuery).length === 0) {
    return {
      statusCode: 400,
      result: {
        code: "MISSING_TARGET",
        message: "Za urejanje zaposlenega potrebujem ime ali id."
      }
    };
  }

  const employee = await Employee.findOne(targetQuery);
  if (!employee) {
    return {
      statusCode: 404,
      result: {
        code: "NOT_FOUND",
        message: `Zaposlenega ${args.name || args.id || ""} nisem nasel.`
      }
    };
  }

  const previousName = employee.name;
  if (data.name !== undefined) employee.name = data.name;
  if (data.workingHoursPerDay !== undefined) employee.workingHoursPerDay = Number(data.workingHoursPerDay) || 8;
  if (Array.isArray(data.skills)) {
    employee.skills = data.skills.map((skill) => String(skill).toLowerCase().trim()).filter(Boolean);
  }
  if (data.addSkill) {
    const skill = String(data.addSkill).toLowerCase().trim();
    if (skill && !employee.skills.includes(skill)) {
      employee.skills.push(skill);
    }
  }
  if (data.removeSkill) {
    const skill = String(data.removeSkill).toLowerCase().trim();
    employee.skills = employee.skills.filter((item) => item !== skill);
  }

  await employee.save();

  if (previousName !== employee.name) {
    await WorkOrderPhase.updateMany(
      { $or: [{ assignedTo: employee._id }, { assignedToName: previousName }] },
      { assignedToName: employee.name }
    );
  }

  return {
    statusCode: 200,
    result: {
      item: employee.toObject(),
      message: `Posodobljen zapis za zaposlenega ${employee.name}.`
    }
  };
}

async function executeCrudTool({ toolName, action, entity, args = {}, actor, provider, rawInput, started }) {
  const config = CRUD_ENTITY_CONFIG[entity];
  const data = { ...args, ...(args.data || {}) };

  if (action !== "get" && !hasConfirmation(args)) {
    const previewMessage = buildConfirmationMessage({ action, entity, config, data, args });
    const output = {
      requiresConfirmation: true,
      code: "CONFIRMATION_REQUIRED",
      tool: toolName,
      arguments: args,
      previewMessage,
      message: previewMessage
    };
    await logMcpCall({ actor, provider, toolName, input: rawInput, output, started });
    return { statusCode: 202, result: output };
  }

  if (action === "get") {
    const query = buildCrudSearchQuery(config, args);
    const rawRows = await maybePopulate(config.model.find(query).sort(config.sort).limit(Number(args.limit) || 25), config.populate).lean();
    const rows = await enrichCrudRows(entity, rawRows);
    const output = {
      count: rows.length,
      items: rows,
      message: buildCrudGetMessage(entity, config, rows)
    };
    await logMcpCall({
      actor,
      provider,
      toolName,
      input: rawInput,
      output: {
        count: rows.length,
        items: rows.map(summarizeCrudLogItem),
        message: output.message
      },
      started
    });
    return { statusCode: 200, result: output };
  }

  if (action === "create") {
    let created;
    if (entity === "work_order") {
      created = await createCrudWorkOrder({ args, actor, provider, rawInput });
    } else if (entity === "order") {
      created = await createCrudOrder(args);
    } else {
      const payload = cleanObject(config.pickData(data));
      created = await config.model.create(payload);
    }

    if (entity === "part") {
      const availableQuantity = data.availableQuantity ?? args.availableQuantity ?? args.quantity;
      if (availableQuantity !== undefined) {
        await Inventory.create({
          partId: created._id,
          availableQuantity: Number(availableQuantity) || 0,
          reservedQuantity: Number(data.reservedQuantity ?? args.reservedQuantity) || 0,
          location: data.location || args.location || "MAIN"
        });
      }
    }

    const output = {
      item: created,
      message: `Ustvarjen zapis za ${config.label}.`
    };
    await logMcpCall({ actor, provider, toolName, input: rawInput, output: { id: created._id }, started });
    return { statusCode: 201, result: output };
  }

  const targetQuery = config.findOne(args);
  if (Object.keys(targetQuery).length === 0) {
    const output = {
      code: "MISSING_TARGET",
      message: `Za ${action} (${config.label}) potrebujem id, kodo, ime ali drug enolicen identifikator.`
    };
    await logMcpCall({ actor, provider, toolName, input: rawInput, output, started });
    return { statusCode: 400, result: output };
  }

  if (action === "update") {
    if (entity === "employee" && (data.addSkill || data.removeSkill || data.name !== undefined || data.workingHoursPerDay !== undefined || data.skills !== undefined)) {
      const employeeUpdate = await updateCrudEmployee({ config, args, data });
      await logMcpCall({
        actor,
        provider,
        toolName,
        input: rawInput,
        output: employeeUpdate.result,
        started
      });
      return employeeUpdate;
    }

    if (
      entity === "product" &&
      (
        data.addRequiredPart ||
        data.addPhase ||
        data.availableQuantity !== undefined ||
        data.reservedQuantity !== undefined ||
        data.location !== undefined ||
        data.quantity !== undefined
      )
    ) {
      const productUpdate = await updateCrudProduct({ config, args, data });
      await logMcpCall({
        actor,
        provider,
        toolName,
        input: rawInput,
        output: productUpdate.result,
        started
      });
      return productUpdate;
    }

    const payload = cleanObject(config.pickData(data));
    const updated = await maybePopulate(
      config.model.findOneAndUpdate(targetQuery, payload, { new: true, runValidators: true }),
      config.populate
    );
    if (!updated) {
      const output = { code: "NOT_FOUND", message: `Zapisa za ${config.label} nisem nasel.` };
      await logMcpCall({ actor, provider, toolName, input: rawInput, output, started });
      return { statusCode: 404, result: output };
    }

    let updatedInventory = null;
    if (
      entity === "part" &&
      (data.availableQuantity !== undefined || data.reservedQuantity !== undefined || data.location !== undefined || data.quantity !== undefined)
    ) {
      const inventoryPayload = cleanObject({
        availableQuantity: data.availableQuantity !== undefined
          ? Number(data.availableQuantity) || 0
          : data.quantity !== undefined
            ? Number(data.quantity) || 0
            : undefined,
        reservedQuantity: data.reservedQuantity === undefined ? undefined : Number(data.reservedQuantity) || 0,
        location: data.location
      });

      updatedInventory = await Inventory.findOneAndUpdate(
        { partId: updated._id },
        {
          $set: inventoryPayload,
          $setOnInsert: {
            partId: updated._id
          }
        },
        { new: true, upsert: true, runValidators: true }
      ).lean();
    }

    const output = {
      item: updated,
      ...(updatedInventory ? { inventory: updatedInventory } : {}),
      message: `Posodobljen zapis za ${config.label}.`
    };
    await logMcpCall({ actor, provider, toolName, input: rawInput, output: { id: updated._id }, started });
    return { statusCode: 200, result: output };
  }

  const deleted = await config.model.findOneAndDelete(targetQuery);
  if (!deleted) {
    const output = { code: "NOT_FOUND", message: `Zapisa za ${config.label} nisem nasel.` };
    await logMcpCall({ actor, provider, toolName, input: rawInput, output, started });
    return { statusCode: 404, result: output };
  }

  if (entity === "part") await Inventory.deleteMany({ partId: deleted._id });
  if (entity === "product") await ProductInventory.deleteMany({ productId: deleted._id });
  if (entity === "employee") {
    await WorkOrderPhase.updateMany({ assignedTo: deleted._id }, { $unset: { assignedTo: "", assignedToName: "" } });
  }
  if (entity === "work_order") {
    await WorkOrderPhase.deleteMany({ workOrderId: deleted._id });
  }

  const output = {
    deletedId: deleted._id,
    message: `Izbrisan zapis za ${config.label}.`
  };
  await logMcpCall({ actor, provider, toolName, input: rawInput, output, started });
  return { statusCode: 200, result: output };
}

export async function executeMcpTool({ toolName, args = {}, actor = "admin", provider = "mock", rawInput = {} }) {
  const started = Date.now();
  const crudTool = CRUD_TOOL_MAP[toolName];

  if (crudTool) {
    return executeCrudTool({ toolName, ...crudTool, args, actor, provider, rawInput, started });
  }

  if (toolName === "check_inventory" || toolName === "check_product_availability") {
    return checkProductAvailability({ args, actor, provider, rawInput, started });
  }
  if (toolName === "get_employee_workload") {
    return getEmployeeWorkload({ args, actor, provider, rawInput, started });
  }
  if (toolName === "summarize_work_order") {
    return summarizeWorkOrder({ args, actor, provider, rawInput, started });
  }
  if (toolName === "generate_work_order_phases") {
    return generateWorkOrderPhases({ args, actor, provider, rawInput, started });
  }
  if (toolName === "process_customer_order" || toolName === "process_work_order") {
    return processWorkOrder({ args, actor, provider, rawInput, started });
  }
  if (toolName === "create_work_order_only") {
    return createBasicWorkOrder({ args, actor, provider, rawInput, started });
  }

  const output = {
    code: "UNKNOWN_MCP_TOOL",
    message: `MCP tool "${toolName}" is not available.`
  };
  await logMcpCall({ actor, provider, toolName: "unknown_mcp_tool", input: rawInput, output, started });
  return { statusCode: 400, result: output };
}
