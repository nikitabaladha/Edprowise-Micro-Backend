import express from "express";
import roleBasedMiddleware from "../middleware/index.js";

import {
  getAllUsersBySchoolId,
  createUser,
  deleteUser,
} from "../controllers/User/index.js";

const router = express.Router();

router.get(
  "/get-all-user-by-school-id/:schoolId",
  roleBasedMiddleware("Admin", "School"),
  getAllUsersBySchoolId
);
router.post("/create-user", roleBasedMiddleware("Admin"), createUser);
router.delete("/user/:id", roleBasedMiddleware("Admin"), deleteUser);

export default router;
