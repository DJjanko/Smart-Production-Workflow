export function buildIntentPrompt({ command, products, today }) {
  const productList = products.map((product) => `- ${product.name}`).join("\n");

  return `You interpret Slovenian and English production workflow requests.

Return one JSON object only. Do not include markdown, comments, or explanations.

Supported intents:
- check_product_availability: check whether parts are available for a product and quantity.
- get_employee_workload: answer workload questions about employees.
- summarize_work_order: summarize one existing work order.
- generate_work_order_phases: add missing phases to an existing work order and assign employees.
- process_work_order: create a work order and run the full workflow.
- create_work_order_only: create only the basic order/work order record, without inventory check, part ordering, phase generation, or employee assignment.
- get_parts, create_part, update_part, delete_part: information and confirmed CRUD for spare parts.
- get_employees, create_employee, update_employee, delete_employee: information and confirmed CRUD for employees.
- get_products, create_product, update_product, delete_product: information and confirmed CRUD for products.
- get_orders, create_order, update_order, delete_order: information and confirmed CRUD for customer orders.
- get_work_orders, create_work_order_record, update_work_order, delete_work_order: information and confirmed CRUD for work orders.
- get_work_order_phases, create_work_order_phase, update_work_order_phase, delete_work_order_phase: information and confirmed CRUD for phases.
- needs_clarification: required data is missing or the request is ambiguous.

Rules:
- Prefer process_work_order for production workflow requests. It is the most important workflow.
- If the user asks to create, make, prepare, or start a work order, use process_work_order.
- If the user asks to assign/generate phases, assign phases to employees, "dodeli faze zaposlenim", "ustvari faze", or explicitly wants production even if finished stock exists, use process_work_order and set args.forceProduction to true.
- If the user explicitly says only/samo/basic record/no automatic assignment/no inventory check, use create_work_order_only.
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
- If update_product adds a required part/material, put it in args.data.addRequiredPart with partName or sku and quantity.
- If update_product adds a production phase, put it in args.data.addPhase with name, durationMinutes, requiredSkill, and dependsOn.
- For product delete/remove requests such as "izbrisi izdelek", "odstrani izdelek", or "delete product", use delete_product.
- For customer order information/list/search requests such as "narocila", "seznam narocil", or "orders", use get_orders.
- If the user asks for orders for a specific customer/company, for example "narocila za AluTech" or "orders for Company B", use get_orders and set args.search and args.customerName to that customer/company name.
- For customer order add/create requests such as "dodaj narocilo", "ustvari narocilo", or "create order", use create_order.
- For customer order edit/update requests such as "uredi narocilo", "spremeni narocilo", or "update order", use update_order.
- For customer order delete/remove requests such as "izbrisi narocilo", "odstrani narocilo", or "delete order", use delete_order.
- For employee information/list/search requests, use get_employees.
- If the user asks for details of a specific employee, use get_employees with args.search or args.name set to that employee name.
- For employee add/create requests such as "dodaj zaposlenega", "ustvari zaposlenega", or "add employee", use create_employee.
- For employee edit/update requests such as "uredi zaposlenega", "spremeni zaposlenega", or "update employee", use update_employee.
- For update_employee, use args.data.addSkill to add one skill, args.data.removeSkill to remove one skill, args.data.skills to replace all skills, args.data.workingHoursPerDay to change hours per day, and args.data.name to rename the employee.
- For employee delete/remove requests such as "izbrisi zaposlenega", "odstrani zaposlenega", or "delete employee", use delete_employee.
- For basic/SAMO work order add/create requests, use create_work_order_only.
- For work order edit/update requests such as "uredi delovni nalog", "spremeni status naloga", or "update work order", use update_work_order.
- For work order delete/remove requests such as "izbrisi delovni nalog", "odstrani nalog", or "delete work order", use delete_work_order.
- For other CRUD information requests, choose the matching get_* intent.
- For other CRUD create/update/delete requests, choose the matching create_*, update_*, or delete_* intent.
- For create/update/delete, set confirmed to true only if the user explicitly wrote a confirmation word such as "potrdi", "potrjujem", "confirm", "approved", or "odobri". Otherwise set confirmed to false.
- Put fields to create or update inside args.data.
- For update/delete, include id, entityId, code, sku, name, productName, or workOrderCode when available.
- Do not invent products. Use only one of the known product names below.
- For work order creation and availability tools, if product or quantity is missing, use needs_clarification.
- For summarize_work_order, if workOrderCode is missing, use needs_clarification.
- For generate_work_order_phases, if workOrderCode is missing, use needs_clarification.
- If a customer is not stated, use "AluTech".
- If a deadline is not stated, set requestedDeadline to null.
- Today is ${today}.

Known products:
${productList || "- No products available"}

JSON schema:
{
  "intent": "one supported intent name",
  "args": {
    "customerName": "string or null",
    "productName": "known product name or null",
    "quantity": "number or null",
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
      "addRequiredPart": {
        "partName": "string",
        "sku": "string",
        "quantity": "number"
      },
      "addPhase": {
        "name": "string",
        "requiredSkill": "string",
        "durationMinutes": "number",
        "dependsOn": ["string"]
      },
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
