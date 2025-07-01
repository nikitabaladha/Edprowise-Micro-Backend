import Joi from "joi";

const BSPLLedgerValidator = Joi.object({
  bSPLLedgerName: Joi.string().required().messages({
    "string.base": "B/S & P&L Ledger Name must be a string.",
    "string.empty": "B/S & P&L Ledger Name cannot be empty.",
    "any.required": "B/S & P&L Ledger Name is required.",
  }),
  headOfAccountId: Joi.string().required().messages({
    "string.base": "Head Of Account Id must be a string.",
    "string.empty": "Head Of Account Id cannot be empty.",
    "any.required": "Head Of Account Id is required.",
  }),
});

export default {
  BSPLLedgerValidator,
};
