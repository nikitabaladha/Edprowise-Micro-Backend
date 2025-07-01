import Joi from "joi";

const GroupLedgerValidator = Joi.object({
  groupLedgerName: Joi.string().required().messages({
    "string.base": "Group Ledger Name must be a string.",
    "string.empty": "Group Ledger Name cannot be empty.",
    "any.required": "Group Ledger Name is required.",
  }),
  headOfAccountId: Joi.string().required().messages({
    "string.base": "Head Of Account Id must be a string.",
    "string.empty": "Head Of Account Id cannot be empty.",
    "any.required": "Head Of Account Id is required.",
  }),
});

export default {
  GroupLedgerValidator,
};
