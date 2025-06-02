import express from "express";

import roleBasedMiddleware from "../middleware/index.js";
import { getSellerById } from "../controllers/Seller/index.js";

const router = express.Router();

router.get(
  "/get-seller-by-id/:id",
  roleBasedMiddleware("Seller"),
  getSellerById
);

export default router;
