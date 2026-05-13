import { ActivityLog } from "../models/ActivityLog.js";
import { PendingMcpAction } from "../models/PendingMcpAction.js";
import { executeMcpTool } from "../services/mcp/tools.js";
import { interpretCommand } from "../services/workflowService.js";
import { interpretCommandWithProvider } from "../services/llm/index.js";

const PENDING_ACTION_TTL_MS = 30 * 60 * 1000;

function serializePendingAction(action) {
  if (!action) return null;

  return {
    id: action._id,
    toolName: action.toolName,
    args: action.args,
    previewMessage: action.previewMessage,
    status: action.status,
    expiresAt: action.expiresAt
  };
}

async function createPendingAction({ req, provider, command, interpreted, result }) {
  const action = await PendingMcpAction.create({
    userId: req.user.sub,
    actor: req.user.name || "admin",
    provider,
    toolName: interpreted.intent,
    args: interpreted.args,
    previewMessage: result.message || `Potrdi akcijo ${interpreted.intent}.`,
    rawInput: { command, interpreted },
    expiresAt: new Date(Date.now() + PENDING_ACTION_TTL_MS)
  });

  return serializePendingAction(action);
}

export async function runCommand(req, res, next) {
  const started = Date.now();

  try {
    const { command, provider = process.env.LLM_DEFAULT_PROVIDER || "mock" } = req.body;
    const interpreted = await interpretCommandWithProvider({
      command: command || "",
      provider,
      fallback: interpretCommand
    });

    if (interpreted.intent !== "needs_clarification") {
      const toolResult = await executeMcpTool({
        toolName: interpreted.intent,
        args: interpreted.args,
        actor: req.user.name || "admin",
        provider,
        rawInput: { command, interpreted }
      });
      const pendingAction = toolResult.result?.requiresConfirmation
        ? await createPendingAction({ req, provider, command, interpreted, result: toolResult.result })
        : null;

      return res.status(toolResult.statusCode).json({
        interpreted,
        tool: interpreted.intent,
        result: toolResult.result,
        pendingAction
      });
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

export async function getPendingActions(req, res, next) {
  try {
    const actions = await PendingMcpAction.find({
      userId: req.user.sub,
      status: "pending",
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.json(actions.map(serializePendingAction));
  } catch (error) {
    next(error);
  }
}

export async function acceptPendingAction(req, res, next) {
  try {
    const action = await PendingMcpAction.findOne({
      _id: req.params.id,
      userId: req.user.sub,
      status: "pending",
      expiresAt: { $gt: new Date() }
    });

    if (!action) {
      return res.status(404).json({ message: "Pending action was not found or has expired." });
    }

    const toolResult = await executeMcpTool({
      toolName: action.toolName,
      args: { ...action.args, confirmed: true },
      actor: req.user.name || action.actor || "admin",
      provider: action.provider,
      rawInput: {
        source: "pending_action_accept",
        pendingActionId: action._id,
        originalInput: action.rawInput
      }
    });

    action.status = "accepted";
    action.resolvedAt = new Date();
    await action.save();

    return res.status(toolResult.statusCode).json({
      interpreted: {
        intent: action.toolName,
        args: { ...action.args, confirmed: true }
      },
      tool: action.toolName,
      result: toolResult.result,
      pendingAction: serializePendingAction(action)
    });
  } catch (error) {
    next(error);
  }
}

export async function declinePendingAction(req, res, next) {
  try {
    const action = await PendingMcpAction.findOne({
      _id: req.params.id,
      userId: req.user.sub,
      status: "pending"
    });

    if (!action) {
      return res.status(404).json({ message: "Pending action was not found." });
    }

    action.status = "declined";
    action.resolvedAt = new Date();
    await action.save();

    await ActivityLog.create({
      actor: req.user.name || action.actor || "admin",
      action: "decline_pending_mcp_action",
      llmProvider: action.provider,
      mcpTool: action.toolName,
      input: { pendingActionId: action._id, args: action.args },
      output: { status: "declined" },
      durationMs: 0
    });

    res.json({
      interpreted: {
        intent: "decline_pending_action",
        args: { pendingActionId: action._id }
      },
      tool: action.toolName,
      result: {
        message: "Akcija je bila zavrnjena.",
        declined: true
      },
      pendingAction: serializePendingAction(action)
    });
  } catch (error) {
    next(error);
  }
}
