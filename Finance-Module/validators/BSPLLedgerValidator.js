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

const bSPLLedgerName = Joi.string().required().messages({
  "string.base": "B/S & P&L Ledger Name must be a string.",
  "string.empty": "B/S & P&L Ledger Name cannot be empty.",
  "any.required": "B/S & P&L Ledger Name is required.",
});
const headOfAccountId = Joi.string().required().messages({
  "string.base": "Head Of Account Id must be a string.",
  "string.empty": "Head Of Account Id cannot be empty.",
  "any.required": "Head Of Account Id is required.",
});

const BSPLLedgerValidator = Joi.object({
  bSPLLedgerName,
  headOfAccountId,
  academicYear: academicYearCreate,
});

const BSPLLedgerValidatorUpdate = Joi.object({
  bSPLLedgerName,
  headOfAccountId,
  academicYear: academicYearUpdate,
});

export default {
  BSPLLedgerValidator,
  BSPLLedgerValidatorUpdate,
};
