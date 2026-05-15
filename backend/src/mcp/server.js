import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { connectDb } from "../config/db.js";
import { executeMcpTool, MCP_TOOLS } from "../services/mcp/tools.js";

const flexibleInputSchema = z.object({
  id: z.string().optional(),
  entityId: z.string().optional(),
  code: z.string().optional(),
  workOrderCode: z.string().optional(),
  sku: z.string().optional(),
  name: z.string().optional(),
  productName: z.string().optional(),
  customerName: z.string().optional(),
  quantity: z.union([z.number(), z.string()]).optional(),
  requestedDeadline: z.string().optional(),
  forceProduction: z.union([z.boolean(), z.string()]).optional(),
  search: z.string().optional(),
  query: z.string().optional(),
  status: z.string().optional(),
  confirmed: z.union([z.boolean(), z.string()]).optional(),
  data: z.record(z.any()).optional()
}).passthrough();

function toolAnnotations(tool) {
  const readOnlyHint = tool.category?.includes("information");
  const destructiveHint = tool.name.startsWith("delete_");

  return {
    readOnlyHint,
    destructiveHint,
    idempotentHint: readOnlyHint
  };
}

function registerWorkflowTools(server) {
  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: `${tool.description} Category: ${tool.category}. Mutating create/update/delete tools require confirmed=true.`,
        inputSchema: flexibleInputSchema,
        annotations: toolAnnotations(tool)
      },
      async (args) => {
        const result = await executeMcpTool({
          toolName: tool.name,
          args,
          actor: "mcp-server",
          provider: "mock",
          rawInput: {
            source: "standalone_mcp_server",
            toolName: tool.name,
            args
          }
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                tool: tool.name,
                statusCode: result.statusCode,
                result: result.result
              }, null, 2)
            }
          ]
        };
      }
    );
  }
}

async function main() {
  await connectDb();

  const server = new McpServer({
    name: "smart-production-workflow-mcp",
    version: "0.1.0"
  });

  registerWorkflowTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Smart Production Workflow MCP server running on stdio.");
}

main().catch((error) => {
  console.error("Failed to start Smart Production Workflow MCP server:", error);
  process.exit(1);
});
