import Joi from "joi";

const LedgerValidator = Joi.object({
  ledgerName: Joi.string().required().messages({
    "string.base": "Ledger Name must be a string.",
    "string.empty": "Ledger Name cannot be empty.",
    "any.required": "Ledger Name is required.",
  }),
  headOfAccountId: Joi.string().required().messages({
    "string.base": "Head Of Account Id must be a string.",
    "string.empty": "Head Of Account Id cannot be empty.",
    "any.required": "Head Of Account Id is required.",
  }),
  groupLedgerId: Joi.string().required().messages({
    "string.base": "Group Ledger Id must be a string.",
    "string.empty": "Group Ledger Id cannot be empty.",
    "any.required": "Group Ledger Id is required.",
  }),
  bSPLLedgerId: Joi.string().required().messages({
    "string.base": "B/S & P&L Ledger Id must be a string.",
    "string.empty": "B/S & P&L Ledger Id cannot be empty.",
    "any.required": "B/S & P&L Ledger Id is required.",
  }),
  openingBalance: Joi.number().required().messages({
    "number.base": "Opening Balance must be a number.",
    "any.required": "Opening Balance is required.",
  }),
});

export default {
  LedgerValidator,
};
