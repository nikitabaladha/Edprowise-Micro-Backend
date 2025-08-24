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

// Ledger Fields
const ledgerName = Joi.string().required().messages({
  "string.base": "Ledger Name must be a string.",
  "string.empty": "Ledger Name cannot be empty.",
  "any.required": "Ledger Name is required.",
});

const headOfAccountId = Joi.string().required().messages({
  "string.base": "Head Of Account Id must be a string.",
  "string.empty": "Head Of Account Id cannot be empty.",
  "any.required": "Head Of Account Id is required.",
});

const groupLedgerId = Joi.string().required().messages({
  "string.base": "Group Ledger Id must be a string.",
  "string.empty": "Group Ledger Id cannot be empty.",
  "any.required": "Group Ledger Id is required.",
});

const bSPLLedgerId = Joi.string().required().messages({
  "string.base": "B/S & P&L Ledger Id must be a string.",
  "string.empty": "B/S & P&L Ledger Id cannot be empty.",
  "any.required": "B/S & P&L Ledger Id is required.",
});

const openingBalance = Joi.number().optional().messages({
  "number.base": "Opening Balance must be a number.",
});

const balanceType = Joi.string()
  .allow("")
  .optional()
  .valid("Debit", "Credit")
  .messages({
    "number.base": "Balance Type must be a string.",
    "any.only": `"Balance Type" must be either 'Debit' or 'Credit'`,
  });

const LedgerValidator = Joi.object({
  ledgerName,
  headOfAccountId,
  groupLedgerId,
  bSPLLedgerId,
  openingBalance,
  balanceType,
  academicYear: academicYearCreate,
});

const LedgerValidatorUpdate = Joi.object({
  ledgerName,
  headOfAccountId,
  groupLedgerId,
  bSPLLedgerId,
  openingBalance,
  balanceType,
  academicYear: academicYearUpdate,
});

export default {
  LedgerValidator,
  LedgerValidatorUpdate,
};
