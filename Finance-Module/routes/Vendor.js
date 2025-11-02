import express from "express";
const router = express.Router();
import roleBasedMiddleware from "../middleware/index.js";

import upload from "../UploadFiles/DocumentImageFilesForVendor.js";

import {
  createVendor,
  getAllVendorBySchoolId,
  updateVendorById,
  deleteVendorById,
  getOneByVendorCode,
} from "../controllers/Setting/Vendor/index.js";

router.post(
  "/create-Vendor",
  upload,
  roleBasedMiddleware("School"),
  createVendor
);

router.get(
  "/get-all-vendor/:financialYear",
  roleBasedMiddleware("School"),
  getAllVendorBySchoolId
);

router.get(
  "/get-one-by-vendor-code/:vendorCode/:financialYear",
  roleBasedMiddleware("School"),
  getOneByVendorCode
);

router.put(
  "/update-vendor-by-id/:id/:financialYear",
  upload,
  roleBasedMiddleware("School"),
  updateVendorById
);

router.delete(
  "/delete-vendor-by-id/:id/:financialYear",
  roleBasedMiddleware("School"),
  deleteVendorById
);

export default router;
