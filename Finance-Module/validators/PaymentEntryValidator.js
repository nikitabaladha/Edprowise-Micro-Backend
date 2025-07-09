// import Joi from "joi";

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

// const academicYearCreate = Joi.string().required().messages({
//   "string.base": "Academic Year must be a string.",
//   "string.empty": "Academic Year cannot be empty.",
//   "any.required": "Academic Year is required.",
// });

// const academicYearUpdate = Joi.string().allow("").optional().messages({
//   "string.base": "Academic Year must be a string.",
//   "string.empty": "Academic Year cannot be empty.",
// });

// const PaymentEntryValidator = Joi.object({
//   vendorCode: Joi.string().required().messages({
//     "any.required": "Vendor code is required",
//     "string.base": "Vendor code must be a string",
//     "string.empty": "Vendor code cannot be empty",
//   }),

//   vendorId: Joi.string()
//     .required()
//     .regex(/^[0-9a-fA-F]{24}$/)
//     .messages({
//       "any.required": "Vendor ID is required",
//       "string.base": "Vendor ID must be a string",
//       "string.empty": "Vendor ID cannot be empty",
//       "string.pattern.base": "Vendor ID must be a valid MongoDB ObjectId",
//     }),

//   entryDate: Joi.date().required().custom(validateFutureOrTodayDate).messages({
//     "any.required": "Entry date is required",
//     "date.base": "Entry date must be a valid date",
//   }),

//   invoiceDate: Joi.date().required().messages({
//     "any.required": "Invoice date is required",
//     "date.base": "Invoice date must be a valid date",
//   }),

//   invoiceNumber: Joi.string().required().messages({
//     "any.required": "Invoice number is required",
//     "string.base": "Invoice number must be a string",
//     "string.empty": "Invoice number cannot be empty",
//   }),

//   poNumber: Joi.string().allow(null, "").optional().messages({
//     "string.base": "PO number must be a string",
//   }),

//   dueDate: Joi.date().required().messages({
//     "any.required": "Due date is required",
//     "date.base": "Due date must be a valid date",
//   }),

//   narration: Joi.string().required().messages({
//     "any.required": "Narration is required",
//     "string.base": "Narration must be a string",
//     "string.empty": "Narration cannot be empty",
//   }),

//   paymentMode: Joi.string()
//     .valid("Cash", "Online", "Cheque")
//     .required()
//     .messages({
//       "any.required": "Payment mode is required",
//       "string.base": "Payment mode must be a string",
//       "any.only": "Payment mode must be either 'Cash', 'Online' or 'Cheque'.",
//       "string.empty": "Payment mode cannot be empty",
//     }),

//   chequeNumber: Joi.string().allow(null, "").optional().messages({
//     "string.base": "Cheque Number must be a string",
//   }),
//   transactionNumber: Joi.string().allow(null, "").optional().messages({
//     "string.base": "Transaction Number must be a string",
//   }),
//   itemDetails: Joi.array()
//     .items(
//       Joi.object({
//         itemName: Joi.string().required().messages({
//           "any.required": "Item name is required.",
//           "string.base": "Item name must be a string.",
//         }),
//         ledgerId: Joi.string().required().messages({
//           "any.required": "Ledger ID is required.",
//           "string.base": "Ledger ID must be a string.",
//         }),
//         amountBeforeGST: Joi.number().required().messages({
//           "any.required": "Amount before GST is required.",
//           "number.base": "Amount before GST must be a number.",
//         }),
//         GSTAmount: Joi.number().required().messages({
//           "any.required": "GST amount is required.",
//           "number.base": "GST amount must be a number.",
//         }),
//         amountAfterGST: Joi.number().required().messages({
//           "any.required": "Amount after GST is required.",
//           "number.base": "Amount after GST must be a number.",
//         }),
//       })
//     )
//     .min(1)
//     .required()
//     .messages({
//       "array.base": "Item details must be an array.",
//       "array.min": "At least one item detail is required.",
//       "any.required": "Item details are required.",
//     }),

//   subTotalAmountAfterGST: Joi.number().required().messages({
//     "any.required": "SubTotal Amount after GST is required.",
//     "number.base": "SubTotal Amount after GST must be a number.",
//   }),
//   TDSorTCS: Joi.string().valid("TDS", "TCS").required().messages({
//     "any.required": "TDS or TCS type is required.",
//     "any.only": "TDSorTCS must be either 'TDS' or 'TCS'.",
//     "string.base": "TDSorTCS must be a string.",
//   }),
//   TDSTCSRateChartId: Joi.string().required().messages({
//     "any.required": "TDS/TCS rate chart ID is required.",
//     "string.base": "TDS/TCS rate chart ID must be a string.",
//   }),
//   TDSTCSRate: Joi.number().required().messages({
//     "any.required": "TDS/TCS rate is required.",
//     "number.base": "TDS/TCS rate must be a number.",
//   }),
//   TDSTCSRateWithAmountBeforeGST: Joi.number().required().messages({
//     "any.required": "TDS/TCS rate with amount before GST is required.",
//     "number.base": "This value must be a number.",
//   }),
//   adjustmentValue: Joi.number().required().messages({
//     "any.required": "Adjustment value is required.",
//     "number.base": "Adjustment value must be a number.",
//   }),
//   totalAmountBeforeGST: Joi.number().required().messages({
//     "any.required": "Total amount before GST is required.",
//     "number.base": "Total amount before GST must be a number.",
//   }),
//   totalGSTAmount: Joi.number().required().messages({
//     "any.required": "Total GST amount is required.",
//     "number.base": "Total GST amount must be a number.",
//   }),
//   totalAmountAfterGST: Joi.number().required().messages({
//     "any.required": "Total amount after GST is required.",
//     "number.base": "Total amount after GST must be a number.",
//   }),

//   TDSTCSRateWithAmountBeforeGST: Joi.number().required(),
//   ledgerIdWithPaymentMode: Joi.string().required().messages({
//     "any.required": "Ledger Id With Payment Mode is required.",
//     "string.base": "Ledger Id With Payment Mode must be a string.",
//   }),
//   status: Joi.string()
//     .valid("Posted", "Draft", "Reversed")
//     .required()
//     .messages({
//       "any.required": "Status is required",
//       "string.base": "Status must be a string",
//       "any.only": "Status must be either 'Posted', 'Draft' or 'Reversed'.",
//       "string.empty": "Status cannot be empty",
//     }),
//   academicYear: Joi.string().required().messages({
//     "string.base": "Academic Year must be a string.",
//     "string.empty": "Academic Year cannot be empty.",
//     "any.required": "Academic Year is required.",
//   }),
// });

// export default {
//   PaymentEntryValidator,
// };

import Joi from "joi";

// === Reusable Field Validators ===

const validateFutureOrTodayDate = (value, helpers) => {
  const inputDate = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);

  if (inputDate < today) {
    return helpers.message("Entry date cannot be in the past");
  }

  return value;
};

const academicYearCreate = Joi.string().required().messages({
  "string.base": "Academic Year must be a string.",
  "string.empty": "Academic Year cannot be empty.",
  "any.required": "Academic Year is required.",
});

const academicYearUpdate = Joi.string().allow("").optional().messages({
  "string.base": "Academic Year must be a string.",
  "string.empty": "Academic Year cannot be empty.",
});

const vendorCode = Joi.string().required().messages({
  "any.required": "Vendor code is required",
  "string.base": "Vendor code must be a string",
  "string.empty": "Vendor code cannot be empty",
});

const vendorId = Joi.string()
  .required()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "any.required": "Vendor ID is required",
    "string.base": "Vendor ID must be a string",
    "string.empty": "Vendor ID cannot be empty",
    "string.pattern.base": "Vendor ID must be a valid MongoDB ObjectId",
  });

const entryDate = Joi.date()
  .required()
  .custom(validateFutureOrTodayDate)
  .messages({
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

const dueDate = Joi.date().required().messages({
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
    "any.required": "Payment mode is required",
    "string.base": "Payment mode must be a string",
    "any.only": "Payment mode must be either 'Cash', 'Online' or 'Cheque'.",
    "string.empty": "Payment mode cannot be empty",
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
      itemName: Joi.string().required().messages({
        "any.required": "Item name is required.",
        "string.base": "Item name must be a string.",
      }),
      ledgerId: Joi.string().required().messages({
        "any.required": "Ledger ID is required.",
        "string.base": "Ledger ID must be a string.",
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

const TDSorTCS = Joi.string().valid("TDS", "TCS").required().messages({
  "any.required": "TDS or TCS type is required.",
  "any.only": "TDSorTCS must be either 'TDS' or 'TCS'.",
  "string.base": "TDSorTCS must be a string.",
});

const TDSTCSRateChartId = Joi.string().required().messages({
  "any.required": "TDS/TCS rate chart ID is required.",
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

const adjustmentValue = Joi.number().required().messages({
  "any.required": "Adjustment value is required.",
  "number.base": "Adjustment value must be a number.",
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
});

const status = Joi.string()
  .valid("Posted", "Draft", "Reversed")
  .required()
  .messages({
    "any.required": "Status is required",
    "string.base": "Status must be a string",
    "any.only": "Status must be either 'Posted', 'Draft' or 'Reversed'.",
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
  adjustmentValue,
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
  adjustmentValue,
  totalAmountBeforeGST,
  totalGSTAmount,
  totalAmountAfterGST,
  ledgerIdWithPaymentMode,
  status,
  academicYear: academicYearUpdate,
});

export default {
  PaymentEntryValidator,
  PaymentEntryValidatorUpdate,
};
