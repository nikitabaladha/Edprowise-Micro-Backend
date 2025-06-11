import express from "express";

import {
  getCart,
  deleteCart,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.get("/get-cart", getCart);

router.delete("/delete-carts", deleteCart);

export default router;
