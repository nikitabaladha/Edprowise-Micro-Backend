import express from "express";

import { getSubscriptionBySchoolId } from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.get("/get-subscription-by-schoolid", getSubscriptionBySchoolId);

export default router;
