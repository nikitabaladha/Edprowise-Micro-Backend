import express from "express";

import {
  createAndUpdateTemplate,
  get,
} from "../controllers/SellerRegistrationTemplate/index.js";

const router = express.Router();

router.get("/get-seller-registration-templates", get);
router.post("/post-seller-registration-templates", createAndUpdateTemplate);

export default router;
