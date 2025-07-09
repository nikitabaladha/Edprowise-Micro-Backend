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

const groupLedgerName = Joi.string().required().messages({
  "string.base": "Group Ledger Name must be a string.",
  "string.empty": "Group Ledger Name cannot be empty.",
  "any.required": "Group Ledger Name is required.",
});
const headOfAccountId = Joi.string().required().messages({
  "string.base": "Head Of Account Id must be a string.",
  "string.empty": "Head Of Account Id cannot be empty.",
  "any.required": "Head Of Account Id is required.",
});
const bSPLLedgerId = Joi.string().required().messages({
  "string.base": "BS & P&L Ledger	Id must be a string.",
  "string.empty": "BS & P&L Ledger Id cannot be empty.",
  "any.required": "BS & P&L Ledger Id is required.",
});

const GroupLedgerValidator = Joi.object({
  groupLedgerName,
  headOfAccountId,
  bSPLLedgerId,
  academicYear: academicYearCreate,
});

const GroupLedgerValidatorUpdate = Joi.object({
  groupLedgerName,
  headOfAccountId,
  bSPLLedgerId,
  academicYear: academicYearUpdate,
});

export default {
  GroupLedgerValidator,
  GroupLedgerValidatorUpdate,
};
