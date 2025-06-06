import express from "express";
import roleBasedMiddleware from "../middleware/index.js";
import upload from "../controllers/UploadFiles/SchoolFiles.js";

import {
  createSchool,
  getAll,
  updateById,
  deleteById,
  getById,
  getSchoolsByIds,
  requiredFieldFromSchoolProfile,
} from "../controllers/SchoolRegistration/index.js";

const router = express.Router();

router.post("/school", upload, roleBasedMiddleware("Admin"), createSchool);
router.get("/school", roleBasedMiddleware("Admin"), getAll);
router.get(
  "/school/:schoolId",
  roleBasedMiddleware("Admin", "School"),
  getById
);

router.get("/get-school-by-ids", roleBasedMiddleware("Admin"), getSchoolsByIds);

router.get(
  "/required-field-from-school-profile/:schoolId",
  requiredFieldFromSchoolProfile
);

router.put("/school/:id", upload, roleBasedMiddleware("Admin"), updateById);

router.put(
  "/school-delete/:schoolId",
  roleBasedMiddleware("Admin"),
  deleteById
);

export default router;
