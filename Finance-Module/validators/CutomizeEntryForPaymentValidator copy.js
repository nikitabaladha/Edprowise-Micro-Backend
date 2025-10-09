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

const invoiceImage = Joi.string().allow("").optional().messages({
  "string.base": "invoiceImage must be a string",
  "string.empty": "invoiceImage cannot be empty",
});

const entryDate = Joi.date().required().messages({
  "any.required": "Entry date is required",
  "date.base": "Entry date must be a valid date",
});

const invoiceDate = Joi.date().allow(null, "").optional().messages({
  "any.required": "Invoice date is required",
  "date.base": "Invoice date must be a valid date",
});

const invoiceNumber = Joi.string().allow(null, "").optional().messages({
  "string.base": "Invoice number must be a string",
});

const poNumber = Joi.string().allow(null, "").optional().messages({
  "string.base": "PO number must be a string",
});

const dueDate = Joi.date().allow(null, "").optional().messages({
  "date.base": "Due date must be a valid date",
});

const narration = Joi.string().required().messages({
  "any.required": "Narration is required",
  "string.base": "Narration must be a string",
  "string.empty": "Narration cannot be empty",
});

const paymentMode = Joi.string()
  .valid("Cash", "Online", "Cheque", "")
  .allow("")
  .optional()
  .messages({
    "any.only": "Payment mode must be Cash, Online, Cheque or empty",
    "string.base": "Payment mode must be a string",
  });

const chequeNumber = Joi.string().allow(null, "").optional().messages({
  "string.base": "Cheque Number must be a string",
});

const transactionNumber = Joi.string().allow(null, "").optional().messages({
  "string.base": "Transaction Number must be a string",
});

const vendorCode = Joi.string().allow("").optional().messages({
  "string.base": "Vendor code must be a string",
});

const vendorId = Joi.string().allow("").optional().messages({
  "string.base": "Vendor ID must be a string",
});

const customizeEntry = Joi.boolean().default(false).messages({
  "boolean.base": "Customize entry must be a boolean",
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
      amountBeforeGST: Joi.number().allow(null, "").optional().messages({
        "number.base": "Amount before GST must be a number.",
      }),
      GSTAmount: Joi.number().allow(null, "").optional().messages({
        "number.base": "GST amount must be a number.",
      }),
      amountAfterGST: Joi.number().allow(null, "").optional().messages({
        "number.base": "Debit Amount must be a number.",
      }),
      creditAmount: Joi.number().allow(null, "").messages({
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

const subTotalAmountAfterGST = Joi.number().required().messages({
  "any.required": "SubTotal of Debit is required.",
  "number.base": "SubTotal of Credit must be a number.",
});

const totalAmountBeforeGST = Joi.number().allow(null).optional().messages({
  "number.base": "Total amount before GST must be a number.",
});

const subTotalOfCredit = Joi.number().required().messages({
  "any.required": "SubTotal of Credit is required.",
  "number.base": "SubTotal of Credit must be a number.",
});

const TDSorTCS = Joi.string()
  .valid("TDS", "TCS", "")
  .allow("")
  .optional()
  .messages({
    "any.only": "TDSorTCS must be TDS, TCS or empty",
  });

const TDSTCSRateChartId = Joi.string().allow("").optional().messages({
  "string.base": "TDS/TCS Rate Chart ID must be a string",
});

const TDSTCSRate = Joi.number().allow(null).optional().messages({
  "number.base": "TDSTCSRate must be a number.",
});

const TDSTCSRateWithAmountBeforeGST = Joi.number()
  .min(0)
  .allow(null)
  .optional()
  .messages({
    "number.base": "TDS/TCS Amount must be a number",
    "number.min": "TDS/TCS Amount cannot be negative",
  });

const totalAmountAfterGST = Joi.number().required().messages({
  "any.required": "Total Debit Amount is required.",
  "number.base": "Total Debit Amount must be a number.",
});

const totalCreditAmount = Joi.number().required().messages({
  "any.required": "Total Credit amount is required.",
  "number.base": "Total Credit amount must be a number.",
});

const chequeImage = Joi.string().allow("").optional().messages({
  "string.base": "Cheque image must be a string",
  "string.empty": "Cheque image cannot be empty",
});

const ledgerIdWithPaymentMode = Joi.string().allow("").optional().messages({
  "string.base": "Ledger ID with payment mode must be a string",
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

const PaymentEntryValidator = Joi.object({
  vendorCode,
  vendorId,
  entryDate,
  invoiceDate,
  invoiceNumber,
  poNumber,
  dueDate,
  narration,
  paymentMode,
  chequeNumber,
  transactionNumber,
  itemDetails,
  subTotalAmountAfterGST,
  TDSorTCS,
  TDSTCSRateChartId,
  TDSTCSRate,
  TDSTCSRateWithAmountBeforeGST,
  totalAmountBeforeGST,
  totalGSTAmount,
  totalAmountAfterGST,
  ledgerIdWithPaymentMode,
  status,

  customizeEntry,
  subTotalOfCredit,
  totalCreditAmount,
  academicYear: academicYearCreate,
});

const PaymentEntryValidatorUpdate = Joi.object({
  vendorCode,
  vendorId,
  entryDate,
  invoiceDate,
  invoiceNumber,
  poNumber,
  dueDate,
  narration,
  paymentMode,
  chequeNumber,
  transactionNumber,
  itemDetails,
  subTotalAmountAfterGST,
  TDSorTCS,
  TDSTCSRateChartId,
  TDSTCSRate,
  TDSTCSRateWithAmountBeforeGST,
  totalAmountBeforeGST,
  totalGSTAmount,
  totalAmountAfterGST,
  ledgerIdWithPaymentMode,
  status,
  academicYear: academicYearUpdate,
  invoiceImage,
  chequeImage,
  customizeEntry,
  subTotalOfCredit,
  totalCreditAmount,
});

export default {
  PaymentEntryValidator,
  PaymentEntryValidatorUpdate,
};
