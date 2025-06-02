import express from "express";

import roleBasedMiddleware from "../middleware/index.js";
import { getAdminById } from "../controllers/Admin/index.js";

const router = express.Router();

router.get("/get-admin-by-id/:id", roleBasedMiddleware("Admin"), getAdminById);

export default router;
