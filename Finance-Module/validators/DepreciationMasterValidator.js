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

const ledgerId = Joi.string().required().messages({
  "any.required": "Ledger ID is required.",
  "string.base": "Ledger ID must be a string.",
});

const groupLedgerId = Joi.string().required().messages({
  "any.required": "Group Ledger ID is required.",
  "string.base": "Group Ledger ID must be a string.",
});

const rateAsPerIncomeTaxAct = Joi.number().min(0).required().messages({
  "number.base": `"Rate As Per Income Tax Act" must be a number`,
  "number.min": `"Rate As Per Income Tax Act" cannot be negative`,
  "any.required": `"Rate As Per Income Tax Act" is required`,
});

const rateAsPerICAI = Joi.number().min(0).required().messages({
  "number.base": `"Rate As Per ICAI" must be a number`,
  "number.min": `"Rate As Per ICAI" cannot be negative`,
  "any.required": `"Rate As Per ICAI" is required`,
});

const DepreciationMasterValidator = Joi.object({
  rateAsPerIncomeTaxAct,
  rateAsPerICAI,
  ledgerId,
  groupLedgerId,
  academicYear: academicYearCreate,
});

const DepreciationMasterValidatorUpdate = Joi.object({
  rateAsPerIncomeTaxAct,
  rateAsPerICAI,
  ledgerId,
  groupLedgerId,
  academicYear: academicYearUpdate,
});

export default {
  DepreciationMasterValidator,
  DepreciationMasterValidatorUpdate,
};
