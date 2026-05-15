export function buildIntentPrompt({ command, products, today, language = "sl" }) {
  const productList = products.map((product) => `- ${product.name}`).join("\n");

  return `You interpret Slovenian and English production workflow requests.

Return one JSON object only. Do not include markdown, comments, or explanations.

Supported intents:
- check_product_availability: check whether parts are available for a product and quantity.
- get_employee_workload: answer workload questions about employees.
- summarize_work_order: summarize one existing work order.
- generate_work_order_phases: add missing phases to an existing work order and assign employees.
- process_work_order: create a work order and run the full workflow. Works for one or multiple products. For a single product use args.productName and args.quantity. For multiple products use args.items as an array of {productName, quantity} objects.
- create_work_order_only: create only the basic order/work order record, without inventory check, part ordering, phase generation, or employee assignment.
- process_existing_order: convert an existing customer order (already in the system) into a production work order with full workflow. Use when the user references an existing order by customer name.
- get_parts, create_part, update_part, delete_part: information and confirmed CRUD for spare parts.
- get_employees, create_employee, update_employee, delete_employee: information and confirmed CRUD for employees.
- get_products, create_product, update_product, delete_product: information and confirmed CRUD for products.
- get_orders, create_order, update_order, delete_order: information and confirmed CRUD for customer orders.
- get_work_orders, create_work_order_record, update_work_order, delete_work_order: information and confirmed CRUD for work orders.
- get_work_order_phases, create_work_order_phase, update_work_order_phase, delete_work_order_phase: information and confirmed CRUD for phases. For get_work_order_phases, always set args.workOrderCode to filter by work order (e.g. "WO-003").
- get_my_phases: returns work order phases assigned to the current user. Use when user asks "moje faze", "prikaži moje faze", "my phases", "katere faze imam".
- get_my_work_orders: returns work orders that have phases assigned to the current user. Use when user asks "moji delovni nalogi", "prikaži moje naloge", "my work orders".
- create_supply_alert: send a supply alert/notification to the admin about a missing or low spare part. Available to all users. Prefer args.sku for the part SKU code (e.g. "VI-08") as it is unique. Also accepts args.partName if SKU is not known. Use args.message for an optional description.
- get_supply_alerts: list all open supply alerts. Admin only. Use args.status="resolved" for resolved alerts.
- needs_clarification: required data is missing or the request is ambiguous.

Rules:
- CRITICAL: If the user says "ustvari naročilo", "dodaj naročilo", "naredi naročilo", or "create order" (without "delovni nalog"), use create_order — NOT process_work_order. create_order only creates the customer order record with no work order or phases. Set args.customerName, args.data.items as [{productId, productName, quantity}], and args.data.requestedDeadline.
- If the command contains "ustvari izdelek", "dodaj izdelek", "naredi nov izdelek", or "add product" followed by a product name, use create_product. This takes strict priority over process_work_order even if "faze" or "deli" are mentioned — in this context they describe the product's manufacturing recipe (catalog data), not a production workflow.
- Prefer process_work_order for production workflow requests when the user wants to start production of an EXISTING product, not when creating a new product catalog entry.
- If the user mentions two or more products with quantities (e.g. "3x Pumpa in 2x Kovinsko ohisje A"), use process_work_order with args.items as an array: [{productName, quantity}, ...].
- If the user asks for a single product, use process_work_order with args.productName and args.quantity.
- If the user asks to assign/generate phases, assign phases to employees, "dodeli faze zaposlenim", "ustvari faze", or explicitly wants production even if finished stock exists, use process_work_order and set args.forceProduction to true.
- If the user explicitly says only/samo/basic record/no automatic assignment/no inventory check, use create_work_order_only.
- If the user says "naredi delovni nalog za narocilo X", "ustvari delovni nalog iz narocila X", "pretvori narocilo X v delovni nalog", or "create work order for order X" where X is a customer name, use process_existing_order and set args.customerName to X.
- For process_existing_order, set confirmed to false (requires confirmation like other workflow actions).
- If the user asks to list, show, check, search, or inspect spare parts, reserve parts, "deli", "rezervni deli", or "zaloga delov" without naming a finished product and quantity, use get_parts.
- If the user asks to list, show, check, search, or inspect finished products, "izdelki", "koncni izdelki", "zaloga izdelkov", or products on the shelf/storage, use get_products.
- Use check_product_availability only when the user asks whether there are enough parts/materials for a specific known finished product and a quantity.
- If the user asks who is busy, free, overloaded, or asks for employee capacity, use get_employee_workload.
- If the user asks for all employees, employee list, "vsi zaposleni", "seznam zaposlenih", or "pokazi zaposlene", use get_employees.
- If the user asks about an existing work order code such as WO-004, use summarize_work_order.
- If the user asks to add, create, generate, or assign phases for an existing work order code such as "Za delovni nalog WO-008 dodaj potrebne faze zaposlenim", use generate_work_order_phases with args.workOrderCode set to that code. Do not ask for product or quantity in this case; the backend reads products from the linked order/work order.
- For spare part information/list/search requests, use get_parts.
- For spare part add/create requests such as "dodaj rezervni del", "ustvari del", or "add part", use create_part.
- For create_part, name and sku are required. If sku is missing, use needs_clarification and ask for SKU.
- If a create_part request includes quantity, stock, "kolicina", "zaloga", or "na voljo", put it in args.data.availableQuantity.
- For spare part edit/update requests such as "uredi rezervni del", "spremeni del", or "update part", use update_part.
- For update_part, minStock/minimalna zaloga changes the spare part minimum stock. availableQuantity/"zaloga na voljo"/"na voljo" changes current inventory stock. These can be changed together in the same update_part request.
- For spare part delete/remove requests such as "izbrisi rezervni del", "odstrani del", or "delete part", use delete_part.
- For product information/list/search requests, use get_products.
- For product add/create requests such as "dodaj izdelek", "ustvari izdelek", or "add product", use create_product.
- Products do not require sku. SKU is only for spare parts. For create_product, put the product name in args.data.name and do not ask for SKU.
- For product edit/update requests such as "uredi izdelek", "spremeni izdelek", or "update product", use update_product.
- For update_product, availableQuantity/"zaloga na voljo"/"na voljo" changes current finished-product inventory stock, not the product catalog name.
- If update_product adds required parts, use args.data.addRequiredPart. For one part use an object {partName, sku, quantity}. For multiple parts use an array [{partName, sku, quantity}, ...].
- If update_product adds production phases, use args.data.addPhase. For one phase use an object {name, requiredSkill, durationMinutes, dependsOn}. For multiple phases use an array [{name, requiredSkill, durationMinutes, dependsOn}, ...].
- For product delete/remove requests such as "izbrisi izdelek", "odstrani izdelek", or "delete product", use delete_product.
- For customer order information/list/search requests such as "narocila", "seznam narocil", or "orders", use get_orders.
- If the user asks for orders for a specific customer/company, for example "narocila za AluTech" or "orders for Company B", use get_orders and set args.search and args.customerName to that customer/company name.
- For customer order add/create requests such as "dodaj narocilo", "ustvari narocilo", or "create order", use create_order.
- For customer order edit/update requests such as "uredi narocilo", "spremeni narocilo", or "update order", use update_order. This takes priority over update_product even if a product name is mentioned — in this context the product name refers to an item inside the order, not the product catalog.
- For update_order, if the user wants to change the quantity of a specific product in the order, use args.data.updateItemQuantity with productName and quantity. Example: "Uredi narocilo BodyFit, Spremeni kolicino Lopata na 3" → args.customerName="BodyFit", args.data.updateItemQuantity={productName:"Lopata", quantity:3}.
- For customer order delete/remove requests such as "izbrisi narocilo", "odstrani narocilo", or "delete order", use delete_order.
- For employee information/list/search requests, use get_employees.
- If the user asks for details of a specific employee, use get_employees with args.search or args.name set to that employee name.
- For employee add/create requests such as "dodaj zaposlenega", "ustvari zaposlenega", or "add employee", use create_employee.
- For employee edit/update requests such as "uredi zaposlenega", "spremeni zaposlenega", or "update employee", use update_employee.
- For update_employee, use args.data.addSkill to add one skill, args.data.removeSkill to remove one skill, args.data.skills to replace all skills, args.data.workingHoursPerDay to change hours per day, and args.data.name to rename the employee.
- For employee delete/remove requests such as "izbrisi zaposlenega", "odstrani zaposlenega", or "delete employee", use delete_employee.
- For basic/SAMO work order add/create requests, use create_work_order_only.
- For work order edit/update requests such as "uredi delovni nalog", "spremeni status naloga", or "update work order", use update_work_order.
- For work order phase status updates by a worker ("spremeni status faze", "oznaci fazo kot zakljuceno", "set phase status"), use update_work_order_phase with args.workOrderCode (e.g. "WO-002"), args.name (phase name e.g. "Rezanje"), and args.data.status ("planned", "in_progress", or "completed").
- For work order delete/remove requests such as "izbrisi delovni nalog", "odstrani nalog", or "delete work order", use delete_work_order.
- For other CRUD information requests, choose the matching get_* intent.
- For other CRUD create/update/delete requests, choose the matching create_*, update_*, or delete_* intent.
- If the user wants to send a notification or alert about a spare part ("opozori admina", "posli opozorilo", "manjka del", "notify admin", "send alert"), use create_supply_alert with args.partName and optionally args.message.
- If the user (admin) wants to see notifications or alerts ("opozorila", "notifikacije", "supply alerts", "pokazi opozorila"), use get_supply_alerts.
- For process_work_order, create_work_order_only, and process_existing_order, always set confirmed to false unless the user explicitly wrote a confirmation word such as "potrdi", "potrjujem", "confirm", "approved", or "odobri".
- For create/update/delete CRUD operations, set confirmed to true only if the user explicitly wrote such a confirmation word. Otherwise set confirmed to false.
- Put fields to create or update inside args.data.
- For update/delete, include id, entityId, code, sku, name, productName, or workOrderCode when available.
- For process_work_order, check_product_availability, and create_work_order_only: productName in args must match exactly one of the known product names listed below. Do not invent or guess product names for these intents. If the product is not in the list, use needs_clarification.
- For create_product: use the product name exactly as the user stated it in args.data.name. It does not need to be in the known products list — the user is creating a new product. Also extract from the command: args.data.description (text after "opis:"), args.data.phases as a JSON array (from "faze:" section using this exact format: "faze: {phaseName}, znanje: {skillValue} in trajanje {minutes} ter brez odvisnosti" — IMPORTANT: "znanje:" is a field label meaning "required skill"; the requiredSkill value is the text that comes AFTER "znanje:", for example if the command says "znanje: sestavljanje" then requiredSkill="sestavljanje", NOT "znanje"), and args.data.addRequiredPart (from "Deli NxName (SKU)" pattern: set sku=SKU and quantity=N).
- For update_product with structured format (containing "opis:", "faze:", or "Deli NxName (SKU)"): extract args.name as only the product name (before the first comma), args.data.description (after "opis:"), args.data.addPhase using the same format (IMPORTANT: "znanje:" is a label — requiredSkill = text after "znanje:", e.g. "znanje: sestavljanje" means requiredSkill="sestavljanje"), and args.data.addRequiredPart (from "Deli NxName (SKU)" pattern: sku=SKU, quantity=N).
- For work order creation and availability tools, if product or quantity is missing, use needs_clarification.
- For summarize_work_order, if workOrderCode is missing, use needs_clarification.
- For generate_work_order_phases, if workOrderCode is missing, use needs_clarification.
- If a customer is not stated, use "AluTech".
- If a deadline is not stated, set requestedDeadline to null.
- Today is ${today}.
- Always use English enum values in the JSON (draft, confirmed, in_production, completed, sold, planned, in_progress, delayed, available, replenished, missing). Never use Slovenian translations in enum fields.
- Write the "message" field in ${language === "en" ? "English" : "Slovenian"}.

Known products:
${productList || "- No products available"}

JSON schema:
{
  "intent": "one supported intent name",
  "args": {
    "customerName": "string or null",
    "productName": "known product name or null",
    "quantity": "number or null",
    "items": [{"productName": "string", "quantity": "number"}],
    "requestedDeadline": "ISO date string or null",
    "forceProduction": "boolean",
    "workOrderCode": "string like WO-004 or null",
    "id": "database id or null",
    "entityId": "database id or null",
    "code": "entity code or null",
    "sku": "part sku or null",
    "name": "entity name or null",
    "search": "search text or null",
    "status": "status filter or null",
    "confirmed": "boolean",
    "data": {
      "name": "string",
      "sku": "string",
      "unit": "string",
      "minStock": "number",
      "availableQuantity": "number",
      "reservedQuantity": "number",
      "location": "string",
      "description": "string",
      "skills": ["string"],
      "addSkill": "string",
      "removeSkill": "string",
      "workingHoursPerDay": "number",
      "status": "string",
      "startDate": "ISO date string",
      "dueDate": "ISO date string",
      "inventoryStatus": "string",
      "workOrderId": "database id",
      "productId": "database id",
      "requiredSkill": "string",
      "phases": [{"name": "string", "requiredSkill": "string", "durationMinutes": "number", "dependsOn": ["string"]}],
      "updateItemQuantity": {"productName": "string", "productId": "database id", "quantity": "number"},
      "addRequiredPart": {"partName": "string", "sku": "string", "quantity": "number"},
      "addPhase": {"name": "string", "requiredSkill": "string", "durationMinutes": "number", "dependsOn": ["string"]},
      "assignedTo": "database id",
      "assignedToName": "string",
      "start": "ISO date string",
      "end": "ISO date string",
      "dependsOn": ["string"]
    }
  },
  "missing": ["product", "quantity", "workOrderCode"],
  "message": "short Slovenian clarification message when needed"
}

User request:
${command}`;
}
