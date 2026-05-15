import { Product } from "../../models/Product.js";
import { Employee } from "../../models/Employee.js";
import { interpretWithOllama } from "./ollamaProvider.js";
import { interpretWithOpenAI } from "./openaiProvider.js";

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
  "create_supply_alert",
  "get_supply_alerts",
  "get_my_phases",
  "get_my_work_orders",
  "process_existing_order",
  "check_product_availability",
  "get_employee_workload",
  "summarize_work_order",
  "generate_work_order_phases",
  ...CRUD_INTENTS
];

function normalize(value = "") {
  if (value === null || value === undefined) return "";
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

function parseStructuredProductCommand(command) {
  const nameMatch = command.match(/(?:ustvari|dodaj|naredi|uredi)\s+izdelek\s+([^,;]+)/i);
  const name = nameMatch ? nameMatch[1].trim() : null;

  const descMatch = command.match(/\bopis\s*:\s*([^,;]+)/i);
  const description = descMatch ? descMatch[1].trim() : null;

  const phaseNameMatch = command.match(/\bfaze\s*:\s*([^,;]+)/i);
  const phaseName = phaseNameMatch ? phaseNameMatch[1].trim() : null;

  const skillMatch = command.match(/\bznanje\s*:\s*([^,;]+?)(?:\s+in\s+trajanje|\s*[,;]|$)/i);
  const requiredSkill = skillMatch ? skillMatch[1].trim().toLowerCase() : null;

  const durationMatch = command.match(/\btrajanje\s+(\d+)/i);
  const durationMinutes = durationMatch ? Number(durationMatch[1]) : null;

  const noDependencies = /brez\s+odvisnosti/i.test(command);

  const partMatch = command.match(/\bDeli\s+(\d+)x[^(]*\(([A-Za-z0-9_-]+)\)/i);
  const partQuantity = partMatch ? Number(partMatch[1]) : null;
  const partSku = partMatch ? partMatch[2] : null;

  return { name, description, phaseName, requiredSkill, durationMinutes, noDependencies, partQuantity, partSku };
}

function inferCrudIntent(command = "", products = [], employees = []) {
  const normalizedCommand = normalize(command);
  const znanjeCnt = (command.match(/\bznanje\s*:/gi) || []).length;
  const isComplexStructured = znanjeCnt > 1 || (command.match(/\bznanje\s*:/gi) || []).length > 0 && /\bDeli\s+\d+x\w+-?\w*\s+in\s+\d+x/i.test(command);
  const isStructuredFormat =
    !isComplexStructured && (
      /\bopis\s*:/i.test(command) ||
      /\bfaze\s*:/i.test(command) ||
      /\bdeli\s+\d/i.test(command)
    );
  const mentionsPartBySku = /\([A-Za-z0-9_-]+\)/.test(command);
  const knownProduct = products.find((p) => normalizedCommand.includes(normalize(p.name)));
  const knownEmployee = findKnownEntityName(command, employees);
  const workOrderCode = command.toUpperCase().match(/WO-\d+/)?.[0] || null;

  // --- SPECIALIZED: generate phases for existing work order ---
  const mentionsPhaseAssignment = wantsProductionPhases(command) || (
    normalizedCommand.includes("faz") && (
      normalizedCommand.includes("dodaj") || normalizedCommand.includes("dodeli") ||
      normalizedCommand.includes("ustvari") || normalizedCommand.includes("potrebn")
    )
  );
  if (workOrderCode && mentionsPhaseAssignment) {
    return { intent: "generate_work_order_phases", args: { workOrderCode, code: workOrderCode, confirmed: false } };
  }

  // --- SPECIALIZED: update work order PHASE by code + phase name ---
  if (workOrderCode && /\b(uredi|spremeni|posodobi|update|edit|oznaci|označi)\b/i.test(normalizedCommand) &&
      (normalizedCommand.includes("faz") || normalizedCommand.includes("phase"))) {
    const phaseStatusMap = { "planiran": "planned", "planirano": "planned", "v procesu": "in_progress", "koncan": "completed", "koncano": "completed", "zakljuceno": "completed", "zaklju": "completed" };
    let phaseStatus = null;
    for (const [term, status] of Object.entries(phaseStatusMap)) {
      if (normalizedCommand.includes(term)) { phaseStatus = status; break; }
    }
    const phaseName =
      command.match(/\/\s*([^/,]+?)\s+na\s/i)?.[1]?.trim() ||
      command.match(/faz[eo]\s+([A-ZČŠŽa-zčšž][a-zA-ZČŠŽčšž\s]+?)\s+(?:pri|na|kot|as)\b/i)?.[1]?.trim() ||
      command.match(/,\s*([a-zA-ZČŠŽčšž][a-zA-ZČŠŽčšž\s]+?)\s+na\s/i)?.[1]?.trim() ||
      null;
    return {
      intent: "update_work_order_phase",
      args: {
        workOrderCode,
        name: phaseName || null,
        confirmed: false,
        data: { ...(phaseStatus ? { status: phaseStatus } : {}) }
      }
    };
  }

  // --- SPECIALIZED: update work order by code ---
  if (workOrderCode && /\b(uredi|spremeni|posodobi|update|edit)\b/i.test(normalizedCommand)) {
    const statusMap = { "planiran": "planned", "planirano": "planned", "v procesu": "in_progress", "koncan": "completed", "koncano": "completed", "končan": "completed", "prodano": "sold", "zamuja": "delayed" };
    const inventoryMap = { "na voljo": "available", "available": "available", "dopolnjeno": "replenished", "replenished": "replenished", "manjka": "missing", "missing": "missing" };
    const data = {};
    for (const [term, status] of Object.entries(statusMap)) {
      if (normalizedCommand.includes(term)) { data.status = status; break; }
    }
    for (const [term, inventoryStatus] of Object.entries(inventoryMap)) {
      if (normalizedCommand.includes(term)) { data.inventoryStatus = inventoryStatus; break; }
    }
    const dueDate = parseSlovenianDateTime(command);
    if (dueDate) data.dueDate = dueDate;
    return { intent: "update_work_order", args: { workOrderCode, code: workOrderCode, confirmed: false, data } };
  }

  // --- VERB + ENTITY detection ---
  const verb =
    /\b(ustvari|dodaj|naredi|create|add)\b/i.test(normalizedCommand) ? "create" :
    /\b(uredi|spremeni|spremni|posodobi|update|edit)\b/i.test(normalizedCommand) ? "update" :
    /\b(izbris|odstrani|delete|remove)\b/i.test(normalizedCommand) ? "delete" :
    /\b(pokazi|prikazi|seznam|preveri|poisci|list|show|find|get|vsi|vse|all)\b/i.test(normalizedCommand) ? "get" :
    null;

  // Entity detection — ORDER MATTERS: specific before generic
  const isWorkOrderEntity =
    normalizedCommand.includes("delovni nalog") ||
    normalizedCommand.includes("work order") ||
    normalizedCommand.includes("workorder");
  const isOrderEntity =
    !isWorkOrderEntity && (
      normalizedCommand.includes("narocil") ||
      /\border\b/i.test(normalizedCommand)
    );
  const isProductEntity =
    normalizedCommand.includes("izdelek") ||
    /\bproduct\b/i.test(normalizedCommand);
  const isPartEntity =
    normalizedCommand.includes("rezervn") ||
    /\bdeli?\b/i.test(normalizedCommand) ||
    normalizedCommand.includes("parts") ||
    normalizedCommand.includes("spare") ||
    mentionsPartBySku;
  const isEmployeeEntity =
    normalizedCommand.includes("zaposlen") ||
    normalizedCommand.includes("delavc") ||
    normalizedCommand.includes("employee") ||
    normalizedCommand.includes("worker");

  const entity =
    isWorkOrderEntity ? "work_order" :
    isOrderEntity ? "order" :
    isProductEntity ? "product" :
    isPartEntity ? "part" :
    isEmployeeEntity ? "employee" :
    null;

  if (!verb || !entity) return null;

  // ===================== CREATE =====================
  if (verb === "create") {
    // "ustvari naročilo" → create_order (NOT process_work_order)
    if (entity === "order") return null; // let LLM parse customerName + items

    if (entity === "product") {
      if (isStructuredFormat) {
        const parsed = parseStructuredProductCommand(command);
        const data = { name: parsed.name };
        if (parsed.description) data.description = parsed.description;
        if (parsed.phaseName && parsed.requiredSkill && Number.isFinite(parsed.durationMinutes)) {
          data.phases = [{ name: parsed.phaseName, requiredSkill: parsed.requiredSkill, durationMinutes: parsed.durationMinutes, dependsOn: [] }];
        }
        if (parsed.partSku && Number.isFinite(parsed.partQuantity)) {
          data.addRequiredPart = { sku: parsed.partSku, quantity: parsed.partQuantity };
        }
        return { intent: "create_product", args: { name: parsed.name, confirmed: false, data } };
      }
      if (isComplexStructured) return null; // let LLM handle multi-phase/part commands
      const rawName = cleanExtractedName(extractNameAfterKeyword(command, ["izdelek", "product"]));
      const name = rawName.split(/\s*[,;]\s*/)[0].trim() || null;
      return { intent: "create_product", args: { name, confirmed: false, data: { name } } };
    }
    // create_order, create_part, create_employee, create_work_order → Ollama/OpenAI
    return null;
  }

  // ===================== UPDATE =====================
  if (verb === "update") {
    if (entity === "product") {
      if (isStructuredFormat) {
        const parsed = parseStructuredProductCommand(command);
        const data = {};
        if (parsed.description) data.description = parsed.description;
        if (parsed.phaseName && parsed.requiredSkill && Number.isFinite(parsed.durationMinutes)) {
          data.addPhase = { name: parsed.phaseName, requiredSkill: parsed.requiredSkill, durationMinutes: parsed.durationMinutes, dependsOn: [] };
        }
        if (parsed.partSku && Number.isFinite(parsed.partQuantity)) {
          data.addRequiredPart = { sku: parsed.partSku, quantity: parsed.partQuantity };
        }
        return { intent: "update_product", args: { name: parsed.name, productName: parsed.name, confirmed: false, data } };
      }
      if (knownProduct) {
        const phaseName = cleanExtractedName(extractFirstMatch(command, /,\s*([^,]+?)\s+naj\s+traja/i));
        const phaseDuration = parseOptionalNumber(extractFirstMatch(command, /(?:naj\s+traja|trajanje|duration)[^\d]*(\d+(?:[.,]\d+)?)/i));
        if (phaseName && Number.isFinite(phaseDuration)) {
          return { intent: "update_product", args: { name: knownProduct.name, productName: knownProduct.name, confirmed: false, data: { addPhase: { name: phaseName, durationMinutes: phaseDuration } } } };
        }
        const availableRaw =
          extractFirstMatch(command, /(?:zalogo\s+izdelka|zalogo\s+na\s+voljo|na\s+voljo|available(?:\s+stock)?)[^\d]*(\d+(?:[.,]\d+)?)/i) ||
          extractFirstMatch(command, /(?:na|=|:)\s*(\d+(?:[.,]\d+)?)\s*$/i);
        const availableQuantity = parseOptionalNumber(availableRaw);
        if (Number.isFinite(availableQuantity)) {
          return { intent: "update_product", args: { name: knownProduct.name, productName: knownProduct.name, confirmed: false, data: { availableQuantity } } };
        }
      }
      // generic update_product — let Ollama handle
      return null;
    }

    if (entity === "part") {
      const sku = extractFirstMatch(command, /\(([A-Za-z0-9_-]+)\)/);
      const name = cleanExtractedName(extractFirstMatch(command, /(?:spremeni|uredi|posodobi|update|edit)\s+([^,(]+)/i));
      const minStockRaw = extractFirstMatch(command, /(?:min\.?\s*zalogo|minimaln[ao]?\s+zalogo|min\s*stock)[^\d]*(\d+(?:[.,]\d+)?)/i);
      const availableRaw = extractFirstMatch(command, /(?:zalogo\s+na\s+voljo|na\s+voljo|available(?:\s+stock)?)[^\d]*(\d+(?:[.,]\d+)?)/i);
      const minStock = Number(minStockRaw.replace(",", "."));
      const availableQuantity = Number(availableRaw.replace(",", "."));
      const data = {};
      if (Number.isFinite(minStock)) data.minStock = minStock;
      if (Number.isFinite(availableQuantity)) data.availableQuantity = availableQuantity;
      return { intent: "update_part", args: { ...(name ? { name } : {}), ...(sku ? { sku } : {}), confirmed: false, data } };
    }

    if (entity === "employee") {
      const target = knownEmployee || null;
      if (!target) return null;
      const addSkill = cleanExtractedName(extractFirstMatch(command, /(?:dodaj(?:\s+mu)?\s+znanje|dodaj\s+spretnost|add\s+skill)\s*:?\s*([^,.]+)/i));
      const removeSkill = cleanExtractedName(extractFirstMatch(command, /(?:odstrani(?:\s+mu)?\s+znanje|odstrani\s+spretnost|remove\s+skill)\s*:?\s*([^,.]+)/i));
      const workingHoursPerDay = parseOptionalNumber(extractFirstMatch(command, /(?:ure\s+na\s+dan|ure|delovne\s+ure|working\s+hours)[^\d]*(\d+(?:[.,]\d+)?)/i));
      const newName = cleanExtractedName(extractFirstMatch(command, /(?:ime|preimenuj|name)[^,.]*\s+v\s+([^,.]+)/i));
      const skillsRaw = !addSkill && !removeSkill ? extractFirstMatch(command, /(?:znanja|spretnosti|skills)\s*(?:na|=|:)\s*([^.;]+)/i) : "";
      const data = {};
      if (addSkill) data.addSkill = addSkill.toLowerCase();
      if (removeSkill) data.removeSkill = removeSkill.toLowerCase();
      if (Number.isFinite(workingHoursPerDay)) data.workingHoursPerDay = workingHoursPerDay;
      if (newName) data.name = newName;
      if (skillsRaw) data.skills = splitCsvWords(skillsRaw);
      return { intent: "update_employee", args: { name: target.name, confirmed: false, data } };
    }

    // update_order, update_work_order (no WO code) → Ollama/OpenAI
    return null;
  }

  // ===================== DELETE =====================
  if (verb === "delete") {
    if (entity === "product") {
      const rawName = cleanExtractedName(extractNameAfterKeyword(command, ["izdelek", "product"]));
      const name = rawName.split(/\s*[,;]\s*/)[0].trim() || knownProduct?.name || null;
      return { intent: "delete_product", args: { name, confirmed: false } };
    }
    if (entity === "part") {
      const sku = extractFirstMatch(command, /\(([A-Za-z0-9_-]+)\)/);
      const rawName = cleanExtractedName(extractNameAfterKeyword(command, ["rezervni del", "del", "part"]));
      const name = rawName.split(/\s*[,;]/)[0].trim() || null;
      return { intent: "delete_part", args: { ...(sku ? { sku } : {}), ...(name ? { name } : {}), confirmed: false } };
    }
    if (entity === "employee" && knownEmployee) {
      return { intent: "delete_employee", args: { name: knownEmployee.name, confirmed: false } };
    }
    // delete_order, delete_work_order, delete_employee (unknown) → Ollama/OpenAI
    return null;
  }

  // ===================== MY PHASES / MY WORK ORDERS =====================
  const mentionsMine = normalizedCommand.includes("moje") || normalizedCommand.includes("moj") || normalizedCommand.includes("my ");
  if (mentionsMine && (normalizedCommand.includes("faz") || normalizedCommand.includes("phase"))) {
    return { intent: "get_my_phases", args: {} };
  }
  if (mentionsMine && (normalizedCommand.includes("nalog") || normalizedCommand.includes("work order") || normalizedCommand.includes("naloge"))) {
    return { intent: "get_my_work_orders", args: {} };
  }

  // --- SPECIALIZED: get phases for specific work order ---
  if (workOrderCode && (normalizedCommand.includes("faz") || normalizedCommand.includes("phase")) &&
      (normalizedCommand.includes("pokazi") || normalizedCommand.includes("prikazi") || normalizedCommand.includes("prikaži") || normalizedCommand.includes("show") || normalizedCommand.includes("list") || normalizedCommand.includes("get"))) {
    return { intent: "get_work_order_phases", args: { workOrderCode, code: workOrderCode, confirmed: false } };
  }

  // ===================== GET =====================
  if (verb === "get") {
    if (entity === "part") {
      const skuMatch = command.match(/\b([A-Za-z]{1,4}-\d{2,4}[A-Za-z0-9]*)\b/i);
      const partSearch = skuMatch?.[1] || null;
      return { intent: "get_parts", args: { search: partSearch, confirmed: false } };
    }
    if (entity === "product") {
      return { intent: "get_products", args: { search: knownProduct?.name || null, confirmed: false } };
    }
    if (entity === "employee") {
      if (knownEmployee) {
        return { intent: "get_employees", args: { search: knownEmployee.name, name: knownEmployee.name, confirmed: false } };
      }
      return { intent: "get_employees", args: { search: null, confirmed: false } };
    }
    if (entity === "order") {
      const orderSearch = extractOrderSearch(command);
      return { intent: "get_orders", args: { search: orderSearch || null, customerName: orderSearch || undefined, confirmed: false } };
    }
    if (entity === "work_order") {
      return { intent: "get_work_orders", args: { confirmed: false } };
    }
  }

  return null;
}

function sanitizeInterpretation(result, products) {
  let intent = normalizeIntent(result?.intent);
  const args = result?.args || {};

  const product = findKnownProduct(args.productName, products);
  const quantity = Number(args.quantity);
  const missing = new Set(Array.isArray(result?.missing) ? result.missing : []);
  const isCrudIntent = CRUD_INTENTS.includes(intent);

  if (["process_work_order", "create_work_order_only", "check_product_availability"].includes(intent)) {
    const hasItems = Array.isArray(args.items) && args.items.length > 0;
    if (!product && !hasItems) missing.add("product");
    if (!Number.isFinite(quantity) || quantity < 1) {
      if (!hasItems) missing.add("quantity");
    }
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

  if (intent === "process_work_order_items") {
    const items = (Array.isArray(args.items) ? args.items : [])
      .map((item) => ({
        productName: item.productName || null,
        quantity: Number(item.quantity) || null
      }))
      .filter((item) => item.productName && item.quantity > 0);
    return {
      intent,
      args: {
        customerName: args.customerName || "AluTech",
        items,
        requestedDeadline: args.requestedDeadline || null
      },
      provider: result?.provider,
      model: result?.model
    };
  }

  if (intent === "get_my_phases" || intent === "get_my_work_orders") {
    return { intent, args: {}, provider: result?.provider, model: result?.model };
  }

  if (intent === "create_supply_alert") {
    return {
      intent,
      args: {
        sku: args.sku || null,
        partName: args.partName || args.name || null,
        message: args.message || args.description || args.opis || null
      },
      provider: result?.provider,
      model: result?.model
    };
  }

  if (intent === "get_supply_alerts") {
    return {
      intent,
      args: { status: args.status || "open" },
      provider: result?.provider,
      model: result?.model
    };
  }

  if (intent === "process_existing_order") {
    return {
      intent,
      args: {
        customerName: args.customerName || null,
        id: args.id || args.orderId || null,
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
      items: Array.isArray(args.items) ? args.items : undefined,
      requestedDeadline: args.requestedDeadline || null,
      workOrderCode: args.workOrderCode || null,
      forceProduction: args.forceProduction === true || args.forceProduction === "true" || args.data?.forceProduction === true
    },
    provider: result?.provider,
    model: result?.model
  };
}

function applyForceProduction(interpreted, command) {
  if (normalizeIntent(interpreted?.intent) === "process_work_order" && wantsProductionPhases(command)) {
    interpreted.args = {
      ...(interpreted.args || {}),
      forceProduction: true
    };
  }
  return interpreted;
}

export async function interpretCommandWithProvider({ command, provider, language = "sl", useGuard = true, fallback }) {
  const products = await Product.find().select("name").lean();

  if (provider === "openai") {
    if (useGuard) {
      const employees = await Employee.find().select("name").lean();
      const inferred = inferCrudIntent(command, products, employees);
      if (inferred) {
        return sanitizeInterpretation({ ...inferred, provider: "rule", model: "local-intent-guard" }, products);
      }
    }
    try {
      const interpreted = applyForceProduction(await interpretWithOpenAI({ command, products, language }), command);
      return sanitizeInterpretation(interpreted, products);
    } catch (error) {
      const interpreted = applyForceProduction(await fallback(command), command);
      return { ...sanitizeInterpretation(interpreted, products), provider: "openai", fallbackProvider: "mock", warning: error.message };
    }
  }

  if (provider === "ollama") {
    if (useGuard) {
      const employees = await Employee.find().select("name").lean();
      const inferred = inferCrudIntent(command, products, employees);
      if (inferred) {
        return sanitizeInterpretation({ ...inferred, provider: "rule", model: "local-intent-guard" }, products);
      }
    }
    try {
      const interpreted = applyForceProduction(await interpretWithOllama({ command, products, language }), command);
      return sanitizeInterpretation(interpreted, products);
    } catch (error) {
      const interpreted = applyForceProduction(await fallback(command), command);
      return { ...sanitizeInterpretation(interpreted, products), provider: "ollama", fallbackProvider: "mock", warning: error.message };
    }
  }

  const interpreted = applyForceProduction(await fallback(command), command);
  return sanitizeInterpretation(interpreted, products);
}
