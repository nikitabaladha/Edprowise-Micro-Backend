import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import {
  createDepreciationMaster,
  getAllDepreciationMasterBySchoolId,
  updateDepreciationMasterById,
  deleteDepreciationMasterById,
  updateAllDepreciationMaster,
} from "../controllers/Setting/DepreciationMaster/index.js";

router.post(
  "/create-depreciation-master",
  roleBasedMiddleware("School"),
  createDepreciationMaster
);

router.get(
  "/get-all-depreciation-master/:financialYear",
  roleBasedMiddleware("School"),
  getAllDepreciationMasterBySchoolId
);

router.put(
  "/update-depreciation-master-by-id/:id/:financialYear",
  roleBasedMiddleware("School"),
  updateDepreciationMasterById
);

router.put(
  "/update-all-depreciation-master/:financialYear",
  roleBasedMiddleware("School"),
  updateAllDepreciationMaster
);

router.delete(
  "/delete-depreciation-master-by-id/:id/:financialYear",
  roleBasedMiddleware("School"),
  deleteDepreciationMasterById
);

export default router;
