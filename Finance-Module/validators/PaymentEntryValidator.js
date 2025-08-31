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

const invoiceImage = Joi.string().allow("").optional().messages({
  "string.base": "invoiceImage must be a string",
  "string.empty": "invoiceImage cannot be empty",
});

const chequeImage = Joi.string().allow("").optional().messages({
  "string.base": "chequeImage must be a string",
  "string.empty": "chequeImage cannot be empty",
});

const vendorCode = Joi.string().allow(null, "").messages({
  "any.required": "Vendor code is required",
  "string.base": "Vendor code must be a string",
  "string.empty": "Vendor code cannot be empty",
});

const vendorId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .allow(null, "")
  .messages({
    "any.required": "Vendor ID is required",
    "string.base": "Vendor ID must be a string",
    "string.empty": "Vendor ID cannot be empty",
    "string.pattern.base": "Vendor ID must be a valid MongoDB ObjectId",
  });

const entryDate = Joi.date().required().messages({
  "any.required": "Entry date is required",
  "date.base": "Entry date must be a valid date",
});

const invoiceDate = Joi.date().required().messages({
  "any.required": "Invoice date is required",
  "date.base": "Invoice date must be a valid date",
});

const invoiceNumber = Joi.string().required().messages({
  "any.required": "Invoice number is required",
  "string.base": "Invoice number must be a string",
  "string.empty": "Invoice number cannot be empty",
});

const poNumber = Joi.string().allow(null, "").optional().messages({
  "string.base": "PO number must be a string",
});

const dueDate = Joi.date().allow(null, "").optional().messages({
  "any.required": "Due date is required",
  "date.base": "Due date must be a valid date",
});

const narration = Joi.string().required().messages({
  "any.required": "Narration is required",
  "string.base": "Narration must be a string",
  "string.empty": "Narration cannot be empty",
});

const paymentMode = Joi.string()
  .valid("Cash", "Online", "Cheque")
  .required()
  .messages({
    "string.empty": "Payment Mode is required.",
    "any.required": "Payment mode is required",
    "string.base": "Payment mode must be a string",
    "any.only": "Payment mode must be either 'Cash', 'Online' or 'Cheque'.",
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
      amountBeforeGST: Joi.number().required().messages({
        "any.required": "Amount before GST is required.",
        "number.base": "Amount before GST must be a number.",
      }),
      GSTAmount: Joi.number().required().messages({
        "any.required": "GST amount is required.",
        "number.base": "GST amount must be a number.",
      }),
      amountAfterGST: Joi.number().required().messages({
        "any.required": "Amount after GST is required.",
        "number.base": "Amount after GST must be a number.",
      }),
    })
  )
  .min(1)
  .required()
  .messages({
    "array.base": "Item details must be an array.",
    "array.min": "At least one item detail is required.",
    "any.required": "Item details are required.",
  });

const subTotalAmountAfterGST = Joi.number().required().messages({
  "any.required": "SubTotal Amount after GST is required.",
  "number.base": "SubTotal Amount after GST must be a number.",
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

const TDSTCSRate = Joi.number().required().messages({
  "any.required": "TDS/TCS rate is required.",
  "number.base": "TDS/TCS rate must be a number.",
});

const TDSTCSRateWithAmountBeforeGST = Joi.number().required().messages({
  "any.required": "TDS/TCS rate with amount before GST is required.",
  "number.base": "This value must be a number.",
});

const totalAmountBeforeGST = Joi.number().required().messages({
  "any.required": "Total amount before GST is required.",
  "number.base": "Total amount before GST must be a number.",
});

const totalGSTAmount = Joi.number().required().messages({
  "any.required": "Total GST amount is required.",
  "number.base": "Total GST amount must be a number.",
});

const totalAmountAfterGST = Joi.number().required().messages({
  "any.required": "Total amount after GST is required.",
  "number.base": "Total amount after GST must be a number.",
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
});

export default {
  PaymentEntryValidator,
  PaymentEntryValidatorUpdate,
};
