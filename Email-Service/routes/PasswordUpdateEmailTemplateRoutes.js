import express from "express";

import {
  createAndUpdate,
  get,
} from "../controllers/passwordUpdateEmailTemplat/index.js";

const router = express.Router();

router.get("/get-password-templates", get);
router.post("/post-password-templates", createAndUpdate);

export default router;
