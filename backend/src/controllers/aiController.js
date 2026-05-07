import { ActivityLog } from "../models/ActivityLog.js";
import {
  checkInventoryForProduct,
  findProductByName,
  interpretCommand,
  processCustomerOrder
} from "../services/workflowService.js";

export async function runCommand(req, res, next) {
  const started = Date.now();

  try {
    const { command, provider = "mock" } = req.body;
    const interpreted = await interpretCommand(command || "");

    if (interpreted.intent === "process_customer_order") {
      const result = await processCustomerOrder({
        ...interpreted.args,
        actor: req.user.name || "admin",
        llmProvider: provider,
        rawInput: { command, interpreted }
      });

      return res.status(201).json({ interpreted, result });
    }

    if (interpreted.intent === "check_inventory") {
      const product = await findProductByName(interpreted.args.productName);
      const inventoryCheck = await checkInventoryForProduct(product, interpreted.args.quantity);

      await ActivityLog.create({
        actor: "admin",
        action: "check_inventory",
        llmProvider: provider,
        mcpTool: "check_inventory",
        input: { command, interpreted },
        output: { productName: product.name, quantity: interpreted.args.quantity, inventoryCheck },
        durationMs: Date.now() - started
      });

      return res.json({ interpreted, result: { product, inventoryCheck } });
    }

    await ActivityLog.create({
      actor: "admin",
      action: "needs_clarification",
      llmProvider: provider,
      mcpTool: null,
      input: { command },
      output: interpreted,
      durationMs: Date.now() - started
    });

    res.status(422).json({ interpreted });
  } catch (error) {
    next(error);
  }
}
