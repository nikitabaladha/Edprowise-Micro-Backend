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

const financialYearCreate = Joi.string().required().messages({
  "string.base": "Academic Year must be a string.",
  "string.empty": "Academic Year cannot be empty.",
  "any.required": "Academic Year is required.",
});

const financialYearUpdate = Joi.string().allow("").optional().messages({
  "string.base": "Academic Year must be a string.",
  "string.empty": "Academic Year cannot be empty.",
});

const receiptImage = Joi.string().allow("").optional().messages({
  "string.base": "Receipt Image must be a string",
  "string.empty": "Receipt Image cannot be empty",
});

const chequeImageForReceipt = Joi.string().allow("").optional().messages({
  "string.base": "chequeImage must be a string",
  "string.empty": "chequeImage cannot be empty",
});

const entryDate = Joi.date().required().messages({
  "any.required": "Entry date is required",
  "date.base": "Entry date must be a valid date",
});

const receiptDate = Joi.date().required().messages({
  "any.required": "Receipt date is required",
  "date.base": "Receipt date must be a valid date",
});

const narration = Joi.string().required().messages({
  "any.required": "Narration is required",
  "string.base": "Narration must be a string",
  "string.empty": "Narration cannot be empty",
});

const paymentMode = Joi.string()
  .valid("Cash", "Online Net Banking", "Cheque/Bank Account")
  .required()
  .messages({
    "string.empty": "Payment Mode is required.",
    "any.required": "Payment mode is required",
    "string.base": "Payment mode must be a string",
    "any.only":
      "Payment mode must be either 'Cash', 'Online Net Banking', or 'Cheque/Bank Account'.",
  });

const chequeNumber = Joi.string().allow(null, "").optional().messages({
  "string.base": "Cheque Number must be a string",
});

const transactionNumber = Joi.string().allow(null, "").optional().messages({
  "string.base": "Transaction Number must be a string",
});

const itemDetails = Joi.array()
  .items(
    Joi.object({
      itemName: Joi.string().allow(null, "").messages({
        "string.base": "Description must be a string.",
      }),
      ledgerId: Joi.string().required().messages({
        "any.required": "Ledger ID is required.",
        "string.base": "Ledger ID must be a string.",
        "string.empty": "Ledger is required.",
      }),
      amount: Joi.number().required().messages({
        "any.required": "Amount is required.",
        "number.base": "Amount must be a number.",
      }),
    })
  )
  .min(1)
  .required()
  .messages({
    "array.min": "At least one item detail is required.",
    "any.required": "Item details are required.",
  });

const subTotalAmount = Joi.number().required().messages({
  "any.required": "SubTotal Amount is required.",
  "number.base": "SubTotal Amount must be a number.",
});

const TDSorTCS = Joi.string()
  .valid("TDS", "TCS")
  .allow("")
  .optional()
  .messages({
    "any.only": "TDSorTCS must be either 'TDS' or 'TCS'.",
    "string.base": "TDSorTCS must be a string.",
  });

const TDSTCSRateChartId = Joi.string().allow("").optional().messages({
  "string.base": "TDS/TCS rate chart ID must be a string.",
});

const TDSTCSRate = Joi.number().allow("").optional().messages({
  "number.base": "TDS/TCS rate must be a number.",
});

const TDSTCSRateWithAmount = Joi.number().allow("").optional().messages({
  "any.required": "TDS/TCS rate with amount is required.",
  "number.base": "TDS/TCS rate with amount must be a number.",
});

const totalAmount = Joi.number().required().messages({
  "any.required": "Total amount is required.",
  "number.base": "Total amount must be a number.",
});

const ledgerIdWithPaymentMode = Joi.string().required().messages({
  "any.required": "Ledger Id With Payment Mode is required.",
  "string.base": "Ledger Id With Payment Mode must be a string.",
  "string.empty": "Ledger With Payment Mode is required.",
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

const ReceiptValidator = Joi.object({
  entryDate,
  receiptDate,
  narration,
  paymentMode,
  chequeNumber,
  transactionNumber,
  itemDetails,
  subTotalAmount,
  TDSorTCS,
  TDSTCSRateChartId,
  TDSTCSRate,
  TDSTCSRateWithAmount,
  totalAmount,
  ledgerIdWithPaymentMode,
  status,
  financialYear: financialYearCreate,
});

const ReceiptValidatorUpdate = Joi.object({
  entryDate,
  receiptDate,
  narration,
  paymentMode,
  chequeNumber,
  transactionNumber,
  itemDetails,
  subTotalAmount,
  TDSorTCS,
  TDSTCSRateChartId,
  TDSTCSRate,
  TDSTCSRateWithAmount,
  totalAmount,
  ledgerIdWithPaymentMode,
  status,
  financialYear: financialYearUpdate,
  receiptImage,
  chequeImageForReceipt,
});

export default {
  ReceiptValidator,
  ReceiptValidatorUpdate,
};
