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

const ledgerId = Joi.string().required().messages({
  "any.required": "Ledger ID is required.",
  "string.base": "Ledger ID must be a string.",
});

const groupLedgerId = Joi.string().required().messages({
  "any.required": "Group Ledger ID is required.",
  "string.base": "Group Ledger ID must be a string.",
});

const chargeDepreciation = Joi.boolean().required().messages({
  "any.required": "Charge Depreciation is required.",
  "boolean.base": "Charge Depreciation must be true or false.",
});

const entryAutomation = Joi.boolean().required().messages({
  "any.required": "Entry Automation is required.",
  "boolean.base": "Entry Automation must be true or false.",
});

const rateAsPerIncomeTaxAct = Joi.number()
  .min(0)
  .allow(null)
  .optional()
  .messages({
    "number.base": `"Rate As Per Income Tax Act" must be a number`,
    "number.min": `"Rate As Per Income Tax Act" cannot be negative`,
  });

const rateAsPerICAI = Joi.number().min(0).allow(null).optional().messages({
  "number.base": `"Rate As Per ICAI" must be a number`,
  "number.min": `"Rate As Per ICAI" cannot be negative`,
});

const DepreciationMasterValidator = Joi.object({
  rateAsPerIncomeTaxAct,
  rateAsPerICAI,
  ledgerId,
  groupLedgerId,
  chargeDepreciation,
  entryAutomation,
  financialYear: financialYearCreate,
});

const DepreciationMasterValidatorUpdate = Joi.object({
  rateAsPerIncomeTaxAct,
  rateAsPerICAI,
  ledgerId,
  groupLedgerId,
  chargeDepreciation,
  entryAutomation,
  financialYear: financialYearUpdate,
});

export default {
  DepreciationMasterValidator,
  DepreciationMasterValidatorUpdate,
};
