import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import upload from "../UploadFiles/AuthorisedSignatureImageFiles.js";

import {
  createAuthorisedSignature,
  getOneAuthorisedSignatureBySchoolId,
  updateAuthorisedSignatureById,
} from "../controllers/Setting/AuthorisedSignature/index.js";

router.post(
  "/create-authorised-signature",
  upload,
  roleBasedMiddleware("School"),
  createAuthorisedSignature
);

router.get(
  "/get-authorised-signature-by-school-id/:financialYear",
  roleBasedMiddleware("School"),
  getOneAuthorisedSignatureBySchoolId
);

router.put(
  "/update-authorised-signature/:id/:financialYear",
  upload,
  roleBasedMiddleware("School"),
  updateAuthorisedSignatureById
);

export default router;
