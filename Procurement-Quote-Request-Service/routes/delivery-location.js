import express from "express";
const router = express.Router();
import roleBasedMiddleware from "../middleware/index.js";
import productImageUpload from "../controllers/UploadFiles/QuoteRequestProductFiles.js";

import { getLocation } from "../controllers/Delivery-Location/index.js";

router.get(
  "/get-location",
  roleBasedMiddleware("Seller", "Admin", "School"),
  getLocation
);

export default router;
