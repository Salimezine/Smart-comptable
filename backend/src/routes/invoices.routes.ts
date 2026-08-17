import { Router, type Router as ExpressRouter } from "express";
import {
  createHandler,
  getHandler,
  listHandler,
  submitHandler,
  syncTeifStatusHandler,
  validateHandler,
} from "../controllers/invoices.controller.js";

export const invoicesRouter: ExpressRouter = Router();

invoicesRouter.get("/company/:companyId", listHandler);
invoicesRouter.post("/company/:companyId", createHandler);
invoicesRouter.get("/:id", getHandler);
invoicesRouter.post("/:id/validate", validateHandler);
invoicesRouter.post("/:id/submit", submitHandler);
invoicesRouter.post("/:id/sync-teif-status", syncTeifStatusHandler);
