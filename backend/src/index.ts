import "dotenv/config";

import express from "express";
import { validateEnv } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import { router } from "./routes/index.js";

validateEnv();

const app = express();
const PORT = process.env["PORT"] ?? 4000;

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "smart-comptable-api", timestamp: new Date().toISOString() });
});

app.use("/api", router);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Smart Comptable API listening on port ${PORT}`);
});
