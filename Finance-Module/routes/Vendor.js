import express from "express";
const router = express.Router();
import roleBasedMiddleware from "../middleware/index.js";

import {
  createVendor,
  getAllVendorBySchoolId,
  updateVendorById,
  deleteVendorById,
} from "../controllers/Setting/Vendor/index.js";

router.post("/create-Vendor", roleBasedMiddleware("School"), createVendor);

router.get(
  "/get-all-vendor",
  roleBasedMiddleware("School"),
  getAllVendorBySchoolId
);

router.put(
  "/update-vendor-by-id/:id",
  roleBasedMiddleware("School"),
  updateVendorById
);

router.delete(
  "/delete-vendor-by-id/:id",
  roleBasedMiddleware("School"),
  deleteVendorById
);

export default router;
