import Joi from "joi";

// const validateFutureOrTodayDate = (value, helpers) => {
//   const inputDate = new Date(value);
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
//   inputDate.setHours(0, 0, 0, 0);

//   if (inputDate < today) {
//     return helpers.message("Entry date cannot be in the past");
//   }

//   return value;
// };

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

const chequeNumber = Joi.string().allow(null, "").optional().messages({
  "string.base": "Cheque Number must be a string",
});

const itemDetails = Joi.array()
  .items(
    Joi.object({
      ledgerId: Joi.string().required().messages({
        "any.required": "Ledger ID is required.",
        "string.base": "Ledger ID must be a string.",
        "string.empty": "Ledger is required.",
      }),
      ledgerIdOfCashAccount: Joi.string().allow(null, "").optional().messages({
        "string.base": "LedgerId Of Cash Account must be a string.",
        "string.empty": "Ledger is required.",
      }),
      debitAmount: Joi.number().required().messages({
        "any.required": "Debit Amount is required.",
        "number.base": "Debit Amount must be a number.",
      }),
      creditAmount: Joi.number().required().messages({
        "any.required": "Credit Amount is required.",
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

const TDSorTCS = Joi.string()
  .valid("TDS", "TCS")
  .allow("")
  .optional()
  .messages({
    "any.only": "TDSorTCS must be either 'TDS' or 'TCS'.",
    "string.base": "TDSorTCS must be a string.",
  });

const TDSTCSRateAmount = Joi.number().required().messages({
  "any.required": "TDS/TCS rate amount is required.",
  "number.base": "TDS/TCS rate amount must be a number.",
});

// const TDSTCSRateAmount = Joi.number().allow("").optional().messages({
//   "any.required": "TDS/TCS rate amount is required.",
//   "number.base": "TDS/TCS rate amount must be a number.",
// });

// .allow("").optional().

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

const contraEntryName = Joi.string()
  .valid("Cash Deposited", "Cash Withdrawn", "Bank Transfer")
  .required()
  .messages({
    "any.required": "Contra Entry Name is required",
    "string.base": "Contra Entry Name must be a string",
    "any.only":
      "Contra Entry Name must be either 'Cash Deposited', 'Cash Withdrawn', or 'Bank Transfer'.",
    "string.empty": "Contra Entry Name can not be empty",
  });

const ContraValidator = Joi.object({
  entryDate,
  contraEntryName,
  dateOfCashDepositedWithdrawlDate,
  narration,
  chequeNumber,
  itemDetails,
  subTotalOfDebit,
  subTotalOfCredit,
  TDSorTCS,
  TDSTCSRateAmount,
  totalAmountOfCredit,
  totalAmountOfDebit,
  status,
  academicYear: academicYearCreate,
});

const ContraValidatorUpdate = Joi.object({
  entryDate,
  contraEntryName,
  dateOfCashDepositedWithdrawlDate,
  narration,
  chequeNumber,
  itemDetails,
  subTotalOfDebit,
  subTotalOfCredit,
  TDSorTCS,
  TDSTCSRateAmount,
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
