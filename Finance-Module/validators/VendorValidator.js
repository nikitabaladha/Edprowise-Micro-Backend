import Joi from "joi";

const academicYearCreate = Joi.string().required().messages({
  "string.base": "Academic Year must be a string.",
  "string.empty": "Academic Year cannot be empty.",
  "any.required": "Academic Year is required.",
});

const academicYearUpdate = Joi.string().allow("").optional().messages({
  "string.base": "Academic Year must be a string.",
  "string.empty": "Academic Year cannot be empty.",
});

const nameOfVendor = Joi.string().required().messages({
  "string.base": "Vendor name must be a string.",
  "string.empty": "Vendor name is required.",
  "any.required": "Vendor name is required.",
});

const email = Joi.string().email().required().messages({
  "string.email": "Email must be a valid email address.",
  "string.empty": "Email is required.",
  "any.required": "Email is required.",
});

const contactNumber = Joi.string()
  .pattern(/^[6-9]\d{9}$/)
  .required()
  .messages({
    "string.pattern.base":
      "Contact number must be a valid 10-digit Indian number.",
    "string.empty": "Contact number is required.",
    "any.required": "Contact number is required.",
  });

const panNumber = Joi.string()
  .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
  .required()
  .messages({
    "string.pattern.base":
      "PAN number must be in a valid format (e.g., ABCDE1234F).",
    "string.empty": "PAN number is required.",
    "any.required": "PAN number is required.",
  });

const gstNumber = Joi.string()
  .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/)
  .allow("")
  .messages({
    "string.pattern.base": "GST number must be in a valid 15-character format.",
  });

const address = Joi.string().required().messages({
  "string.empty": "Address is required.",
  "any.required": "Address is required.",
});

const state = Joi.string().required().messages({
  "string.empty": "State is required.",
  "any.required": "State is required.",
});

const nameOfAccountHolder = Joi.string().required().messages({
  "string.empty": "Name of account holder is required.",
  "any.required": "Name of account holder is required.",
});

const nameOfBank = Joi.string().required().messages({
  "string.empty": "Bank name is required.",
  "any.required": "Bank name is required.",
});

const ifscCode = Joi.string()
  .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
  .required()
  .messages({
    "string.pattern.base": "IFSC code must be valid (e.g., HDFC0001234).",
    "string.empty": "IFSC code is required.",
    "any.required": "IFSC code is required.",
  });

const accountNumber = Joi.string()
  .pattern(/^\d{9,18}$/)
  .required()
  .messages({
    "string.pattern.base": "Account number must be between 9 and 18 digits.",
    "string.empty": "Account number is required.",
    "any.required": "Account number is required.",
  });

const accountType = Joi.string().required().messages({
  "any.only": "Account type must be one of the predefined values.",
  "string.empty": "Account type is required.",
  "any.required": "Account type is required.",
});

const documentImage = Joi.string().allow("").optional().messages({
  "string.base": "Attachment Image must be a string",
  "string.empty": "Attachment Image cannot be empty",
});

const openingBalance = Joi.number()
  .allow(null, "")
  .default(0)
  .optional()
  .messages({
    "number.base": "Opening Balance must be a number.",
  });
const paymentTerms = Joi.number().allow(null, "").optional().messages({
  "number.base": "Payment Terms must be a number.",
});

const VendorValidator = Joi.object({
  nameOfVendor,
  email,
  contactNumber,
  panNumber,
  gstNumber,
  address,
  state,
  nameOfAccountHolder,
  nameOfBank,
  ifscCode,
  accountNumber,
  accountType,
  openingBalance,
  paymentTerms,
  academicYear: academicYearCreate,
});

const VendorValidatorUpdate = Joi.object({
  nameOfVendor,
  email,
  contactNumber,
  panNumber,
  gstNumber,
  address,
  state,
  nameOfAccountHolder,
  nameOfBank,
  ifscCode,
  accountNumber,
  accountType,
  openingBalance,
  documentImage,
  paymentTerms,
  academicYear: academicYearUpdate,
});

export default {
  VendorValidator,
  VendorValidatorUpdate,
};
