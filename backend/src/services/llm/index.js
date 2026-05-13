import { Product } from "../../models/Product.js";
import { interpretWithOllama } from "./ollamaProvider.js";

const CRUD_INTENTS = [
  "get_parts",
  "create_part",
  "update_part",
  "delete_part",
  "get_employees",
  "create_employee",
  "update_employee",
  "delete_employee",
  "get_products",
  "create_product",
  "update_product",
  "delete_product",
  "get_work_orders",
  "create_work_order_record",
  "update_work_order",
  "delete_work_order",
  "get_work_order_phases",
  "create_work_order_phase",
  "update_work_order_phase",
  "delete_work_order_phase"
];

const ALLOWED_INTENTS = [
  "process_work_order",
  "create_work_order_only",
  "check_product_availability",
  "get_employee_workload",
  "summarize_work_order",
  ...CRUD_INTENTS
];

function normalize(value = "") {
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findKnownProduct(productName, products) {
  const wanted = normalize(productName);
  if (!wanted) return null;

  return products.find((product) => normalize(product.name) === wanted)
    || products.find((product) => normalize(product.name).includes(wanted) || wanted.includes(normalize(product.name)))
    || null;
}

function normalizeIntent(rawIntent) {
  if (rawIntent === "process_customer_order" || rawIntent === "create_work_order") {
    return "process_work_order";
  }
  if (rawIntent === "check_inventory") {
    return "check_product_availability";
  }
  return rawIntent;
}

function sanitizeInterpretation(result, products) {
  const intent = normalizeIntent(result?.intent);
  const args = result?.args || {};
  const product = findKnownProduct(args.productName, products);
  const quantity = Number(args.quantity);
  const missing = new Set(Array.isArray(result?.missing) ? result.missing : []);
  const isCrudIntent = CRUD_INTENTS.includes(intent);

  if (["process_work_order", "create_work_order_only", "check_product_availability"].includes(intent)) {
    if (!product) missing.add("product");
    if (!Number.isFinite(quantity) || quantity < 1) missing.add("quantity");
  }
  if (intent === "summarize_work_order" && !args.workOrderCode) {
    missing.add("workOrderCode");
  }

  if (
    !ALLOWED_INTENTS.includes(intent) || missing.size > 0
  ) {
    return {
      intent: "needs_clarification",
      missing: Array.from(missing),
      message: result?.message || "Potrebujem se izdelek in kolicino, da lahko nadaljujem.",
      provider: result?.provider,
      model: result?.model
    };
  }

  if (isCrudIntent) {
    return {
      intent,
      args: {
        ...args,
        confirmed: args.confirmed === true || args.confirmed === "true"
      },
      provider: result?.provider,
      model: result?.model
    };
  }

  return {
    intent,
    args: {
      customerName: args.customerName || "AluTech",
      productName: product?.name || null,
      quantity: Number.isFinite(quantity) ? quantity : null,
      requestedDeadline: args.requestedDeadline || null,
      workOrderCode: args.workOrderCode || null
    },
    provider: result?.provider,
    model: result?.model
  };
}

export async function interpretCommandWithProvider({ command, provider, fallback }) {
  if (provider !== "ollama") {
    return fallback(command);
  }

  const products = await Product.find().select("name").lean();

  try {
    const interpreted = await interpretWithOllama({ command, products });
    return sanitizeInterpretation(interpreted, products);
  } catch (error) {
    const interpreted = await fallback(command);
    return {
      ...interpreted,
      provider: "ollama",
      fallbackProvider: "mock",
      warning: error.message
    };
  }
}
