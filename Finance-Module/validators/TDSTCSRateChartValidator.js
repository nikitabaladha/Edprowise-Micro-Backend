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

const TDSorTCS = Joi.string().valid("TDS", "TCS").required().messages({
  "string.base": `"TDS or TCS" must be a string`,
  "any.only": `"TDS or TCS" must be either 'TDS' or 'TCS'`,
  "any.required": `"TDS or TCS" is required`,
  "string.empty": `"TDS or TCS" cannot be empty`,
});

const natureOfTransaction = Joi.string().required().messages({
  "string.base": `"Nature of Transaction" must be a string`,
  "any.required": `"Nature of Transaction" is required`,
  "string.empty": `"Nature of Transaction" cannot be empty`,
});

const rate = Joi.number().min(0).required().messages({
  "number.base": `"Rate" must be a number`,
  "number.min": `"Rate" cannot be negative`,
  "any.required": `"Rate" is required`,
});

const guidance = Joi.string().allow("").optional().messages({
  "string.base": "Guidance must be a string",
});

const TDSTCSRateChartValidator = Joi.object({
  TDSorTCS,
  rate,
  natureOfTransaction,
  guidance,
  financialYear: financialYearCreate,
});

const TDSTCSRateChartValidatorUpdate = Joi.object({
  TDSorTCS,
  rate,
  natureOfTransaction,
  guidance,
  financialYear: financialYearUpdate,
});

export default {
  TDSTCSRateChartValidator,
  TDSTCSRateChartValidatorUpdate,
};
