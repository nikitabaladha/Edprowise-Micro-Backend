import express from "express";

import {
  getCategoryById,
  getCategoriesByIds,
  getSubCategoriesByIds,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.get("/categories/:id", getCategoryById);

router.get("/categories-by-ids", getCategoriesByIds);

router.get("/subcategories", getSubCategoriesByIds);

export default router;
