import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import { getAllBySchoolId } from "../controllers/AccountEntry/AllLedgers/index.js";

router.get(
  "/get-all-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllBySchoolId
);

export default router;
