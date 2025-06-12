import express from "express";

import { sendNotification } from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.post("/send-notification", sendNotification);

export default router;
