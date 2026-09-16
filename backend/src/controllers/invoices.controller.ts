import type { NextFunction, Request, Response } from "express";
import {
  CreateInvoiceSchema,
  createInvoice,
  getInvoice,
  listInvoices,
  submitInvoice,
  syncTeifStatus,
  validateInvoice,
} from "../business-logic/invoices/invoices.service.js";

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const invoices = await listInvoices(req.user!.userId, req.params["companyId"] as string);
    res.json(invoices);
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await getInvoice(req.user!.userId, req.params["id"] as string);
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = CreateInvoiceSchema.parse(req.body);
    const invoice = await createInvoice(
      req.user!.userId,
      req.params["companyId"] as string,
      input,
    );
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function validateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await validateInvoice(req.user!.userId, req.params["id"] as string);
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function submitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyTaxId } = req.body as { companyTaxId?: string };
    if (!companyTaxId) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "companyTaxId is required" });
      return;
    }
    const result = await submitInvoice(req.user!.userId, req.params["id"] as string, companyTaxId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function syncTeifStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncTeifStatus(req.user!.userId, req.params["id"] as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
