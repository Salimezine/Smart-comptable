import type { NextFunction, Request, Response } from "express";
import {
  LoginSchema,
  RegisterSchema,
  login,
  register,
} from "../business-logic/auth/auth.service.js";

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = RegisterSchema.parse(req.body);
    const result = await register(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = LoginSchema.parse(req.body);
    const result = await login(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
