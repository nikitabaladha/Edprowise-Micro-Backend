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

const entryDate = Joi.date().required().messages({
  "any.required": "Entry date is required",
  "date.base": "Entry date must be a valid date",
});

const dateOfCashDepositedWithdrawlDate = Joi.date().required().messages({
  "any.required": "Date of Cash Deposited/Withdrawl/BankTransfer is required",
  "date.base":
    "Date of Cash Deposited/Withdrawl/BankTransfer must be a valid date",
});

const itemDetails = Joi.array()
  .items(
    Joi.object({
      itemName: Joi.string().optional().allow(null, "").messages({
        "string.base": "Description must be a string.",
      }),
      ledgerId: Joi.string().required().messages({
        "any.required": "Ledger ID is required.",
        "string.base": "Ledger ID must be a string.",
        "string.empty": "Ledger is required.",
      }),
      ledgerIdOfCashAccount: Joi.string().allow(null, "").optional().messages({
        "string.base": "LedgerId Of Cash Account must be a string.",
      }),
      debitAmount: Joi.number().allow(null, "").optional().messages({
        "number.base": "Debit Amount must be a number.",
      }),
      creditAmount: Joi.number().allow(null, "").optional().messages({
        "number.base": "Credit Amount must be a number.",
      }),
    })
  )
  .min(1)
  .required()
  .messages({
    "array.min": "At least one item detail is required.",
    "any.required": "Item details are required.",
  });

const subTotalOfDebit = Joi.number().required().messages({
  "any.required": "SubTotal Amount Of Debit is required.",
  "number.base": "SubTotal Amount Of Debit must be a number.",
});

const subTotalOfCredit = Joi.number().required().messages({
  "any.required": "SubTotal Amount Of Credit is required.",
  "number.base": "SubTotal Amount Of Credit must be a number.",
});

const totalAmountOfDebit = Joi.number().required().messages({
  "any.required": "Total Debit Amount is required.",
  "number.base": "Total Debit Amount must be a number.",
});

const totalAmountOfCredit = Joi.number().required().messages({
  "any.required": "Total Credit Amount is required.",
  "number.base": "Total Credit Amount must be a number.",
});

const narration = Joi.string().required().messages({
  "any.required": "Narration is required",
  "string.base": "Narration must be a string",
  "string.empty": "Narration cannot be empty",
});

const chequeImageForContra = Joi.string().allow("").optional().messages({
  "string.base": "Cheque Image must be a string",
  "string.empty": "Cheque Image cannot be empty",
});

const status = Joi.string()
  .valid("Posted", "Draft", "Reversed", "Cancelled")
  .required()
  .messages({
    "any.required": "Status is required",
    "string.base": "Status must be a string",
    "any.only":
      "Status must be either 'Posted', 'Draft', 'Reversed' or 'Cancelled'.",
    "string.empty": "Status cannot be empty",
  });

const customizeEntry = Joi.boolean().default(false).messages({
  "boolean.base": "Customize entry must be a boolean",
});

const ContraValidator = Joi.object({
  entryDate,
  dateOfCashDepositedWithdrawlDate,
  narration,
  itemDetails,
  subTotalOfDebit,
  subTotalOfCredit,
  totalAmountOfCredit,
  totalAmountOfDebit,
  status,
  academicYear: academicYearCreate,
  customizeEntry,
});

const ContraValidatorUpdate = Joi.object({
  entryDate,
  dateOfCashDepositedWithdrawlDate,
  narration,
  itemDetails,
  subTotalOfDebit,
  subTotalOfCredit,
  totalAmountOfCredit,
  totalAmountOfDebit,
  status,
  chequeImageForContra,
  academicYear: academicYearUpdate,
});

export default {
  ContraValidator,
  ContraValidatorUpdate,
};
