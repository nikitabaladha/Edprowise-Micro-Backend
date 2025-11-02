import Joi from "joi";

const financialYearCreate = Joi.string().required().messages({
  "string.base": "Academic Year must be a string.",
  "string.empty": "Academic Year cannot be empty.",
  "any.required": "Academic Year is required.",
});

const financialYearUpdate = Joi.string().allow("").optional().messages({
  "string.base": "Academic Year must be a string.",
  "string.empty": "Academic Year cannot be empty.",
});

const attachmentImage = Joi.string().allow("").optional().messages({
  "string.base": "Attachment Image must be a string",
  "string.empty": "Attachment Image cannot be empty",
});

const openingBalance = Joi.number().optional().messages({
  "number.base": "Opening Balance must be a number.",
});
const paymentTerms = Joi.number().optional().messages({
  "number.base": "Payment Terms must be a number.",
});

const FinancialInformationValidator = Joi.object({
  openingBalance,
  paymentTerms,
  financialYear: financialYearCreate,
});

const FinancialInformationValidatorUpdate = Joi.object({
  openingBalance,
  attachmentImage,
  paymentTerms,
  financialYear: financialYearUpdate,
});

export default {
  FinancialInformationValidator,
  FinancialInformationValidatorUpdate,
};
