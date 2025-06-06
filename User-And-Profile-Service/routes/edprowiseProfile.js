import express from "express";
const router = express.Router();
import roleBasedMiddleware from "../middleware/index.js";
import upload from "../controllers/UploadFiles/EdprowiseFiles.js";

import {
  create,
  getById,
  updateById,
  requiredFieldFromEdprowise,
} from "../controllers/EdprowiseProfile/index.js";

router.post("/edprowise-profile", upload, roleBasedMiddleware("Admin"), create);
router.put(
  "/edprowise-profile/:id",
  upload,
  roleBasedMiddleware("Admin"),
  updateById
);
router.get(
  "/edprowise-profile",
  roleBasedMiddleware("Admin", "Seller", "School"),
  getById
);
router.get(
  "/required-field-from-edprowise-profile",
  requiredFieldFromEdprowise
);

export default router;
