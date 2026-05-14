import { Product } from "../../models/Product.js";
import { Employee } from "../../models/Employee.js";
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
  "get_orders",
  "create_order",
  "update_order",
  "delete_order",
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
  "generate_work_order_phases",
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

function findKnownEntityName(command = "", entities = []) {
  const normalizedCommand = normalize(command);
  return entities.find((entity) => normalizedCommand.includes(normalize(entity.name))) || null;
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

function extractNameAfterKeyword(command = "", keywords = []) {
  const normalizedCommand = normalize(command);
  const normalizedKeywords = keywords.map((keyword) => normalize(keyword));
  const match = normalizedKeywords
    .map((keyword) => ({ keyword, index: normalizedCommand.indexOf(keyword) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)[0];

  if (!match) return "";

  return command.slice(match.index + match.keyword.length).trim().replace(/^[\s:,-]+/, "");
}

function cleanExtractedName(value = "") {
  return value
    .replace(/\s+tako\s+da.*$/i, "")
    .replace(/\s+dodaj.*$/i, "")
    .replace(/\s+and\s+add.*$/i, "")
    .replace(/[,.;]+$/g, "")
    .trim();
}

function extractFirstMatch(command = "", pattern) {
  const match = command.match(pattern);
  return match?.[1]?.trim() || "";
}

function extractOrderSearch(command = "") {
  const match = command.match(/(?:naro[cč]il[ao]?\s+za|orders?\s+for|za\s+podjetje|za\s+stranko)\s+([^,.]+)/i);
  const value = cleanExtractedName(match?.[1] || "");

  return value.replace(/\s+(prosim|please)$/i, "").trim();
}

function parseOptionalNumber(value = "") {
  if (!value) return NaN;
  return Number(value.replace(",", "."));
}

function splitCsvWords(value = "") {
  return value
    .split(/,| in | and /i)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function wantsProductionPhases(command = "") {
  const normalizedCommand = normalize(command);
  return (
    normalizedCommand.includes("dodeli faze") ||
    normalizedCommand.includes("faze zaposlen") ||
    normalizedCommand.includes("dodaj faze") ||
    normalizedCommand.includes("ustvari faze") ||
    normalizedCommand.includes("assign phases") ||
    normalizedCommand.includes("generate phases") ||
    normalizedCommand.includes("produce") ||
    normalizedCommand.includes("proizved")
  );
}

function parseSlovenianDateTime(value = "") {
  const match = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,\s*(\d{1,2}):(\d{2}))?/);
  if (!match) return null;

  const [, day, month, year, hour = "00", minute = "00"] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}`;
}

function inferCrudIntent(command = "", products = [], employees = []) {
  const normalizedCommand = normalize(command);
  const mentionsParts =
    normalizedCommand.includes("rezervn") ||
    normalizedCommand.includes("delov") ||
    normalizedCommand.includes("dele") ||
    normalizedCommand.includes("parts") ||
    normalizedCommand.includes("spare");
  const mentionsPartBySku = /\([A-Za-z0-9_-]+\)/.test(command);
  const asksForStock =
    normalizedCommand.includes("zaloga") ||
    normalizedCommand.includes("zalog") ||
    normalizedCommand.includes("stock") ||
    normalizedCommand.includes("inventory") ||
    normalizedCommand.includes("preveri") ||
    normalizedCommand.includes("pokazi") ||
    normalizedCommand.includes("prikazi") ||
    normalizedCommand.includes("list") ||
    normalizedCommand.includes("seznam");
  const mentionsProductStock =
    normalizedCommand.includes("izdelk") ||
    normalizedCommand.includes("koncn") ||
    normalizedCommand.includes("finished") ||
    normalizedCommand.includes("product");
  const mentionsEmployees =
    normalizedCommand.includes("zaposlen") ||
    normalizedCommand.includes("delavc") ||
    normalizedCommand.includes("employee") ||
    normalizedCommand.includes("worker");
  const mentionsWorkOrdersText =
    normalizedCommand.includes("delovni nalog") ||
    normalizedCommand.includes("work order") ||
    normalizedCommand.includes("workorder");
  const mentionsOrders =
    !mentionsWorkOrdersText && (
      normalizedCommand.includes("narocil") ||
      normalizedCommand.includes("order")
    );
  const asksForList =
    normalizedCommand.includes("vsi") ||
    normalizedCommand.includes("vse") ||
    normalizedCommand.includes("all") ||
    normalizedCommand.includes("list") ||
    normalizedCommand.includes("seznam") ||
    normalizedCommand.includes("pokazi") ||
    normalizedCommand.includes("prikazi");
  const asksToCreate =
    normalizedCommand.includes("dodaj") ||
    normalizedCommand.includes("ustvari") ||
    normalizedCommand.includes("naredi") ||
    normalizedCommand.includes("create") ||
    normalizedCommand.includes("add");
  const asksToUpdate =
    normalizedCommand.includes("uredi") ||
    normalizedCommand.includes("spremeni") ||
    normalizedCommand.includes("spremni") ||
    normalizedCommand.includes("posodobi") ||
    normalizedCommand.includes("update") ||
    normalizedCommand.includes("edit");
  const mentionsKnownProduct = products.some((product) => normalizedCommand.includes(normalize(product.name)));
  const knownProduct = products.find((product) => normalizedCommand.includes(normalize(product.name)));
  const knownEmployee = findKnownEntityName(command, employees);
  const workOrderCode = command.toUpperCase().match(/WO-\d+/)?.[0] || null;
  const orderSearch = extractOrderSearch(command);
  const mentionsPhaseAssignment = wantsProductionPhases(command) || (
    normalizedCommand.includes("faz") &&
    (
      normalizedCommand.includes("dodaj") ||
      normalizedCommand.includes("dodeli") ||
      normalizedCommand.includes("ustvari") ||
      normalizedCommand.includes("potrebn")
    )
  );

  if (workOrderCode && mentionsPhaseAssignment) {
    return {
      intent: "generate_work_order_phases",
      args: {
        workOrderCode,
        code: workOrderCode,
        confirmed: false
      }
    };
  }

  if (workOrderCode && asksToUpdate) {
    const statusMap = {
      "planiran": "planned",
      "planirano": "planned",
      "v procesu": "in_progress",
      "koncan": "completed",
      "koncano": "completed",
      "končan": "completed",
      "končano": "completed",
      "prodano": "sold",
      "zamuja": "delayed"
    };
    const inventoryMap = {
      "na voljo": "available",
      "available": "available",
      "dopolnjeno": "replenished",
      "replenished": "replenished",
      "manjka": "missing",
      "missing": "missing"
    };
    const data = {};

    for (const [term, status] of Object.entries(statusMap)) {
      if (normalizedCommand.includes(term)) {
        data.status = status;
        break;
      }
    }
    for (const [term, inventoryStatus] of Object.entries(inventoryMap)) {
      if (normalizedCommand.includes(term)) {
        data.inventoryStatus = inventoryStatus;
        break;
      }
    }

    const dueDate = parseSlovenianDateTime(command);
    if (dueDate) data.dueDate = dueDate;

    return {
      intent: "update_work_order",
      args: {
        workOrderCode,
        code: workOrderCode,
        confirmed: false,
        data
      }
    };
  }

  if (mentionsParts && asksForStock && !mentionsKnownProduct && !asksToUpdate) {
    return {
      intent: "get_parts",
      args: {
        search: null,
        confirmed: false
      }
    };
  }

  if ((mentionsParts || mentionsPartBySku) && asksToUpdate && !mentionsKnownProduct) {
    const sku = extractFirstMatch(command, /\(([A-Za-z0-9_-]+)\)/);
    const name = cleanExtractedName(
      extractFirstMatch(command, /(?:spremeni|uredi|posodobi|update|edit)\s+([^,(]+)/i)
    );
    const minStockRaw = extractFirstMatch(command, /(?:min\.?\s*zalogo|minimaln[ao]?\s+zalogo|min\s*stock)[^\d]*(\d+(?:[.,]\d+)?)/i);
    const availableRaw = extractFirstMatch(command, /(?:zalogo\s+na\s+voljo|na\s+voljo|available(?:\s+stock)?)[^\d]*(\d+(?:[.,]\d+)?)/i);
    const minStock = Number(minStockRaw.replace(",", "."));
    const availableQuantity = Number(availableRaw.replace(",", "."));
    const data = {};

    if (Number.isFinite(minStock)) data.minStock = minStock;
    if (Number.isFinite(availableQuantity)) data.availableQuantity = availableQuantity;

    return {
      intent: "update_part",
      args: {
        ...(name ? { name } : {}),
        ...(sku ? { sku } : {}),
        confirmed: false,
        data
      }
    };
  }

  if (mentionsKnownProduct && asksToUpdate) {
    const phaseName = cleanExtractedName(extractFirstMatch(command, /,\s*([^,]+?)\s+naj\s+traja/i));
    const phaseDuration = parseOptionalNumber(extractFirstMatch(command, /(?:naj\s+traja|trajanje|duration)[^\d]*(\d+(?:[.,]\d+)?)/i));
    if (phaseName && Number.isFinite(phaseDuration)) {
      return {
        intent: "update_product",
        args: {
          name: knownProduct.name,
          productName: knownProduct.name,
          confirmed: false,
          data: {
            addPhase: {
              name: phaseName,
              durationMinutes: phaseDuration
            }
          }
        }
      };
    }

    const availableRaw = extractFirstMatch(command, /(?:zalogo\s+izdelka|zalogo\s+na\s+voljo|na\s+voljo|available(?:\s+stock)?)[^\d]*(\d+(?:[.,]\d+)?)/i)
      || extractFirstMatch(command, /(?:na|=|:)\s*(\d+(?:[.,]\d+)?)\s*$/i);
    const availableQuantity = parseOptionalNumber(availableRaw);

    if (Number.isFinite(availableQuantity)) {
      return {
        intent: "update_product",
        args: {
          name: knownProduct.name,
          productName: knownProduct.name,
          confirmed: false,
          data: {
            availableQuantity
          }
        }
      };
    }
  }

  if (mentionsProductStock && asksForStock && !asksToUpdate) {
    return {
      intent: "get_products",
      args: {
        search: knownProduct?.name || null,
        confirmed: false
      }
    };
  }

  if (mentionsProductStock && asksToCreate && !normalizedCommand.includes("delovni nalog")) {
    const name = cleanExtractedName(extractNameAfterKeyword(command, ["izdelek", "product"]));

    return {
      intent: "create_product",
      args: {
        name: name || null,
        confirmed: false,
        data: {
          name: name || null
        }
      }
    };
  }

  if (mentionsProductStock && asksToUpdate) {
    const productName = cleanExtractedName(extractNameAfterKeyword(command, ["izdelek", "product"]));
    const sku = extractFirstMatch(command, /\(([A-Za-z0-9_-]+)\)/);
    const partName = cleanExtractedName(extractFirstMatch(command, /(?:del|material)\s+([^,(]+)/i));
    const partQuantity = parseOptionalNumber(extractFirstMatch(command, /(?:kolicina|količina|quantity)\s+(\d+(?:[.,]\d+)?)/i));
    const phaseName = cleanExtractedName(extractFirstMatch(command, /fazo\s+([^:,]+)/i));
    const durationMinutes = parseOptionalNumber(extractFirstMatch(command, /(?:trajanje|duration)\s+(\d+)/i));
    const requiredSkill = cleanExtractedName(extractFirstMatch(command, /(?:znanje|skill)\s+([^,.]+)/i));
    const noDependencies = normalizedCommand.includes("brez odvisnosti") || normalizedCommand.includes("no dependencies");
    const data = {};

    if (sku || partName || Number.isFinite(partQuantity)) {
      data.addRequiredPart = {
        ...(partName ? { partName } : {}),
        ...(sku ? { sku } : {}),
        ...(Number.isFinite(partQuantity) ? { quantity: partQuantity } : {})
      };
    }

    if (phaseName || Number.isFinite(durationMinutes) || requiredSkill) {
      data.addPhase = {
        ...(phaseName ? { name: phaseName } : {}),
        ...(requiredSkill ? { requiredSkill } : {}),
        ...(Number.isFinite(durationMinutes) ? { durationMinutes } : {}),
        dependsOn: noDependencies ? [] : undefined
      };
    }

    return {
      intent: "update_product",
      args: {
        name: productName || knownProduct?.name || null,
        productName: productName || knownProduct?.name || null,
        confirmed: false,
        data
      }
    };
  }

  if (mentionsOrders && asksForList && !asksToCreate && !asksToUpdate) {
    return {
      intent: "get_orders",
      args: {
        search: orderSearch || null,
        customerName: orderSearch || undefined,
        confirmed: false
      }
    };
  }

  if (knownEmployee && (asksToUpdate || normalizedCommand.includes("dodaj znanje") || normalizedCommand.includes("odstrani znanje"))) {
    const addSkill = cleanExtractedName(extractFirstMatch(command, /(?:dodaj(?:\s+mu)?\s+znanje|dodaj\s+spretnost|add\s+skill)\s+([^,.]+)/i));
    const removeSkill = cleanExtractedName(extractFirstMatch(command, /(?:odstrani(?:\s+mu)?\s+znanje|odstrani\s+spretnost|remove\s+skill)\s+([^,.]+)/i));
    const workingHoursRaw = extractFirstMatch(command, /(?:ure\s+na\s+dan|ure|delovne\s+ure|working\s+hours)[^\d]*(\d+(?:[.,]\d+)?)/i);
    const workingHoursPerDay = parseOptionalNumber(workingHoursRaw);
    const newName = cleanExtractedName(extractFirstMatch(command, /(?:ime|preimenuj|name)[^,.]*\s+v\s+([^,.]+)/i));
    const skillsRaw = !addSkill && !removeSkill
      ? extractFirstMatch(command, /(?:znanja|spretnosti|skills)\s*(?:na|=|:)\s*([^.;]+)/i)
      : "";
    const data = {};

    if (addSkill) data.addSkill = addSkill.toLowerCase();
    if (removeSkill) data.removeSkill = removeSkill.toLowerCase();
    if (Number.isFinite(workingHoursPerDay)) data.workingHoursPerDay = workingHoursPerDay;
    if (newName) data.name = newName;
    if (skillsRaw) data.skills = splitCsvWords(skillsRaw);

    return {
      intent: "update_employee",
      args: {
        name: knownEmployee.name,
        confirmed: false,
        data
      }
    };
  }

  if (knownEmployee && (asksForList || normalizedCommand.includes("podrobnost") || normalizedCommand.includes("details"))) {
    return {
      intent: "get_employees",
      args: {
        search: knownEmployee.name,
        name: knownEmployee.name,
        confirmed: false
      }
    };
  }

  if (mentionsEmployees && asksForList) {
    return {
      intent: "get_employees",
      args: {
        search: null,
        confirmed: false
      }
    };
  }

  return null;
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
  if (intent === "generate_work_order_phases" && !(args.workOrderCode || args.code)) {
    missing.add("workOrderCode");
  }
  if (intent === "create_part") {
    const data = { ...args, ...(args.data || {}) };
    if (!data.name) missing.add("name");
    if (!data.sku) missing.add("sku");
  }

  if (
    !ALLOWED_INTENTS.includes(intent) || missing.size > 0
  ) {
    return {
      intent: "needs_clarification",
      missing: Array.from(missing),
      message: result?.message || (intent === "create_part" && missing.has("sku")
        ? "Za rezervni del potrebujem se SKU oziroma enolicno sifro dela."
        : "Potrebujem se izdelek in kolicino, da lahko nadaljujem."),
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

  if (intent === "generate_work_order_phases") {
    return {
      intent,
      args: {
        workOrderCode: args.workOrderCode || args.code || null,
        code: args.code || args.workOrderCode || null,
        confirmed: false
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
      workOrderCode: args.workOrderCode || null,
      forceProduction: args.forceProduction === true || args.forceProduction === "true" || args.data?.forceProduction === true
    },
    provider: result?.provider,
    model: result?.model
  };
}

export async function interpretCommandWithProvider({ command, provider, fallback }) {
  if (provider !== "ollama") {
    const products = await Product.find().select("name").lean();
    const interpreted = await fallback(command);
    if (normalizeIntent(interpreted?.intent) === "process_work_order" && wantsProductionPhases(command)) {
      interpreted.args = {
        ...(interpreted.args || {}),
        forceProduction: true
      };
    }
    return sanitizeInterpretation(interpreted, products);
  }

  const products = await Product.find().select("name").lean();
  const employees = await Employee.find().select("name").lean();
  const inferred = inferCrudIntent(command, products, employees);

  if (inferred) {
    return sanitizeInterpretation({
      ...inferred,
      provider: "rule",
      model: "local-intent-guard"
    }, products);
  }

  try {
    const interpreted = await interpretWithOllama({ command, products });
    if (normalizeIntent(interpreted?.intent) === "process_work_order" && wantsProductionPhases(command)) {
      interpreted.args = {
        ...(interpreted.args || {}),
        forceProduction: true
      };
    }
    return sanitizeInterpretation(interpreted, products);
  } catch (error) {
    const interpreted = await fallback(command);
    if (normalizeIntent(interpreted?.intent) === "process_work_order" && wantsProductionPhases(command)) {
      interpreted.args = {
        ...(interpreted.args || {}),
        forceProduction: true
      };
    }
    return {
      ...sanitizeInterpretation(interpreted, products),
      provider: "ollama",
      fallbackProvider: "mock",
      warning: error.message
    };
  }
}
