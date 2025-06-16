import express from "express";
import roleBasedMiddleware from "../middleware/index.js";

import {
  quotePDFRequirements,
  invoiceForEdprowisePDFRequirements,
  invoiceForBuyerPDFRequirements,
  quotePDFRequirementsForBuyer,
  invoiceForBuyerPDFRequirementsForEmail,
  invoiceForEdprowisePDFRequirementsForEmail,
} from "../controllers/PDFForFrontend/index.js";

const router = express.Router();

router.get(
  "/generate-quote-pdf",
  roleBasedMiddleware("Admin", "School", "Seller"),
  quotePDFRequirements
);

router.get(
  "/generate-quote-pdf-for-buyer",
  roleBasedMiddleware("School"),
  quotePDFRequirementsForBuyer
);

router.get(
  "/generate-edprowise-invoice-pdf",
  roleBasedMiddleware("Admin", "Seller"),
  invoiceForEdprowisePDFRequirements
);

router.get(
  "/generate-buyer-invoice-pdf",
  roleBasedMiddleware("Admin", "School", "Seller"),
  invoiceForBuyerPDFRequirements
);

router.get(
  "/invoice-for-buyer-PDF-requirements-for-email/:sellerId/:enquiryNumber/:schoolId",
  invoiceForBuyerPDFRequirementsForEmail
);

router.get(
  "/invoice-for-buyer-PDF-requirements-for-email/:sellerId/:enquiryNumber/:schoolId",
  invoiceForEdprowisePDFRequirementsForEmail
);

export default router;
