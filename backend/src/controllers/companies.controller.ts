import type { NextFunction, Request, Response } from "express";
import {
  CreateCompanySchema,
  UpdateCompanySchema,
  createCompany,
  deleteCompany,
  getCompany,
  listCompanies,
  updateCompany,
} from "../business-logic/companies/companies.service.js";

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const companies = await listCompanies(req.user!.userId);
    res.json(companies);
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const company = await getCompany(req.user!.userId, req.params["id"] as string);
    res.json(company);
  } catch (err) {
    next(err);
  }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = CreateCompanySchema.parse(req.body);
    const company = await createCompany(req.user!.userId, input);
    res.status(201).json(company);
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = UpdateCompanySchema.parse(req.body);
    const company = await updateCompany(req.user!.userId, req.params["id"] as string, input);
    res.json(company);
  } catch (err) {
    next(err);
  }
}

export async function removeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteCompany(req.user!.userId, req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
