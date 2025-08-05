import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import {
  createDepreciationMaster,
  getAllDepreciationMasterBySchoolId,
  updateDepreciationMasterById,
  deleteDepreciationMasterById,
} from "../controllers/Setting/DepreciationMaster/index.js";

router.post(
  "/create-depreciation-master",
  roleBasedMiddleware("School"),
  createDepreciationMaster
);

router.get(
  "/get-all-depreciation-master/:academicYear",
  roleBasedMiddleware("School"),
  getAllDepreciationMasterBySchoolId
);

router.put(
  "/update-depreciation-master-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  updateDepreciationMasterById
);

router.delete(
  "/delete-depreciation-master-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  deleteDepreciationMasterById
);

export default router;
