export function buildIntentPrompt({ command, products, today }) {
  const productList = products.map((product) => `- ${product.name}`).join("\n");

  return `You interpret Slovenian and English production workflow requests.

Return one JSON object only. Do not include markdown, comments, or explanations.

Supported intents:
- check_product_availability: check whether parts are available for a product and quantity.
- get_employee_workload: answer workload questions about employees.
- summarize_work_order: summarize one existing work order.
- process_work_order: create a work order and run the full workflow.
- create_work_order_only: create only the basic order/work order record, without inventory check, part ordering, phase generation, or employee assignment.
- get_parts, create_part, update_part, delete_part: information and confirmed CRUD for spare parts.
- get_employees, create_employee, update_employee, delete_employee: information and confirmed CRUD for employees.
- get_products, create_product, update_product, delete_product: information and confirmed CRUD for products.
- get_work_orders, create_work_order_record, update_work_order, delete_work_order: information and confirmed CRUD for work orders.
- get_work_order_phases, create_work_order_phase, update_work_order_phase, delete_work_order_phase: information and confirmed CRUD for phases.
- needs_clarification: required data is missing or the request is ambiguous.

Rules:
- Prefer process_work_order for production workflow requests. It is the most important workflow.
- If the user asks to create, make, prepare, or start a work order, use process_work_order.
- If the user explicitly says only/samo/basic record/no automatic assignment/no inventory check, use create_work_order_only.
- If the user only asks about stock, materials, availability, or whether there are enough parts, use check_product_availability.
- If the user asks who is busy, free, overloaded, or asks for employee capacity, use get_employee_workload.
- If the user asks about an existing work order code such as WO-004, use summarize_work_order.
- For CRUD information requests, choose the matching get_* intent.
- For CRUD create/update/delete requests, choose the matching create_*, update_*, or delete_* intent.
- For create/update/delete, set confirmed to true only if the user explicitly wrote a confirmation word such as "potrdi", "potrjujem", "confirm", "approved", or "odobri". Otherwise set confirmed to false.
- Put fields to create or update inside args.data.
- For update/delete, include id, entityId, code, sku, name, productName, or workOrderCode when available.
- Do not invent products. Use only one of the known product names below.
- For work order and availability tools, if product or quantity is missing, use needs_clarification.
- For summarize_work_order, if workOrderCode is missing, use needs_clarification.
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
      "description": "string",
      "skills": ["string"],
      "workingHoursPerDay": "number",
      "status": "string",
      "startDate": "ISO date string",
      "dueDate": "ISO date string",
      "inventoryStatus": "string",
      "workOrderId": "database id",
      "productId": "database id",
      "requiredSkill": "string",
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
