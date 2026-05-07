import cors from "cors";
import express from "express";
import morgan from "morgan";
import "./models/Part.js";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { dashboardRouter } from "./routes/dashboard.js";

export const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3001" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.send("Express backend is running.");
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "smart-production-workflow-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api", catalogRouter);
app.use("/api/ai", aiRouter);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || "Unexpected server error." });
});
