import Joi from "joi";

const TDSTCSRateChartValidator = Joi.object({
  TDSorTCS: Joi.string().valid("TDS", "TCS").required().messages({
    "string.base": `"TDS or TCS" must be a string`,
    "any.only": `"TDS or TCS" must be either 'TDS' or 'TCS'`,
    "any.required": `"TDS or TCS" is required`,
    "string.empty": `"TDS or TCS" cannot be empty`,
  }),

  rate: Joi.number().min(0).required().messages({
    "number.base": `"Rate" must be a number`,
    "number.min": `"Rate" cannot be negative`,
    "any.required": `"Rate" is required`,
  }),

  natureOfTransaction: Joi.string().required().messages({
    "string.base": `"Nature of Transaction" must be a string`,
    "any.required": `"Nature of Transaction" is required`,
    "string.empty": `"Nature of Transaction" cannot be empty`,
  }),
});

export default {
  TDSTCSRateChartValidator,
};
