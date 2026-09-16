import { Router, type Router as ExpressRouter } from "express";
import {
  createHandler,
  getHandler,
  listHandler,
  removeHandler,
  updateHandler,
} from "../controllers/companies.controller.js";

export const companiesRouter: ExpressRouter = Router();

companiesRouter.get("/", listHandler);
companiesRouter.post("/", createHandler);
companiesRouter.get("/:id", getHandler);
companiesRouter.patch("/:id", updateHandler);
companiesRouter.delete("/:id", removeHandler);
