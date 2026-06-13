import { Router, type Router as ExpressRouter } from "express";
import { requireAuth } from "../middleware/auth.js";
import { teifWebhookHandler } from "../controllers/webhook.controller.js";
import { authRouter } from "./auth.routes.js";
import { companiesRouter } from "./companies.routes.js";
import { invoicesRouter } from "./invoices.routes.js";
import { membersRouter } from "./members.routes.js";

export const router: ExpressRouter = Router();

router.use("/auth", authRouter);
router.use("/companies", requireAuth, companiesRouter);
router.use("/companies", requireAuth, membersRouter);
router.use("/invoices", requireAuth, invoicesRouter);
router.post("/webhooks/teif-status", teifWebhookHandler);
