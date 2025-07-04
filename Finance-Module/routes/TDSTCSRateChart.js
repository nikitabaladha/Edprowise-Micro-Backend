import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import {
  createTDSTCSRateChart,
  getAllTDSTCSRateChartBySchoolId,
  updateTDSTCSRateChartById,
  deleteTDSTCSRateChartById,
  getAllByTDSOrTCS,
} from "../controllers/Setting/TDSTCSRateChart/index.js";

router.post(
  "/create-rate-chart",
  roleBasedMiddleware("School"),
  createTDSTCSRateChart
);

router.get(
  "/get-all-rate-chart",
  roleBasedMiddleware("School"),
  getAllTDSTCSRateChartBySchoolId
);

router.get(
  "/get-all-rate-chart-by-tds-or-tcs",
  roleBasedMiddleware("School"),
  getAllByTDSOrTCS
);

router.put(
  "/update-rate-chart-by-id/:id",
  roleBasedMiddleware("School"),
  updateTDSTCSRateChartById
);

router.delete(
  "/delete-rate-chart-by-id/:id",
  roleBasedMiddleware("School"),
  deleteTDSTCSRateChartById
);

export default router;
