import { Router, type Router as ExpressRouter } from "express";
import { loginHandler, registerHandler } from "../controllers/auth.controller.js";

export const authRouter: ExpressRouter = Router();

authRouter.post("/register", registerHandler);
authRouter.post("/login", loginHandler);
