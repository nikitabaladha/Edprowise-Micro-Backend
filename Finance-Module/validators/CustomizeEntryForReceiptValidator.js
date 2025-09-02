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

const receiptImage = Joi.string().allow("").optional().messages({
  "string.base": "Receipt Image must be a string",
  "string.empty": "Receipt Image cannot be empty",
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
      amount: Joi.number().optional().allow(null).messages({
        "number.base": "Credit Amount must be a number.",
      }),
      debitAmount: Joi.number().optional().allow(null).messages({
        "string.base": "Debit Amount must be a string.",
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

const subTotalAmount = Joi.number().required().messages({
  "any.required": "SubTotal Amount is required.",
  "number.base": "SubTotal Amount must be a number.",
});

const subTotalOfDebit = Joi.number().required().messages({
  "any.required": "SubTotal of Debit is required.",
  "number.base": "SubTotal of Debit must be a number.",
});

const totalAmount = Joi.number().required().messages({
  "any.required": "Total amount is required.",
  "number.base": "Total amount must be a number.",
});

const totalDebitAmount = Joi.number().required().messages({
  "any.required": "Total Debit amount is required.",
  "number.base": "Total Debit amount must be a number.",
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

const ReceiptValidator = Joi.object({
  entryDate,
  receiptDate,
  narration,
  itemDetails,
  subTotalAmount,
  totalAmount,
  status,
  academicYear: academicYearCreate,
  subTotalOfDebit,
  totalDebitAmount,
  customizeEntry,
});

const ReceiptValidatorUpdate = Joi.object({
  entryDate,
  receiptDate,
  narration,
  itemDetails,
  subTotalAmount,
  totalAmount,
  status,
  academicYear: academicYearUpdate,
  receiptImage,
  subTotalOfDebit,
  totalDebitAmount,
  customizeEntry,
});

export default {
  ReceiptValidator,
  ReceiptValidatorUpdate,
};
