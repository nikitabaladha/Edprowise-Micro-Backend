import express from "express";

import { checkEmailExists } from "../controllers/CrossServiceAPI/index.js";

const router = express.Router();

router.post("/check-email-exists", checkEmailExists);

export default router;
