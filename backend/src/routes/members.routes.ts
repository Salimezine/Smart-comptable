import { Router, type Router as ExpressRouter } from "express";
import {
  acceptInviteHandler,
  createInviteHandler,
  listInvitesHandler,
  listMembersHandler,
  removeMemberHandler,
  updateMemberRoleHandler,
} from "../controllers/members.controller.js";

export const membersRouter: ExpressRouter = Router();

membersRouter.get("/:companyId/members", listMembersHandler);
membersRouter.patch("/:companyId/members/:memberId", updateMemberRoleHandler);
membersRouter.delete("/:companyId/members/:memberId", removeMemberHandler);
membersRouter.post("/:companyId/invites", createInviteHandler);
membersRouter.get("/:companyId/invites", listInvitesHandler);
membersRouter.post("/invites/accept", acceptInviteHandler);
