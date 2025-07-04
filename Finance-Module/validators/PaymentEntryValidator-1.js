import Joi from "joi";

const PaymentEntryValidator = Joi.object({
  vendorCode: Joi.string().required().messages({
    "any.required": "Vendor code is required",
    "string.base": "Vendor code must be a string",
    "string.empty": "Vendor code cannot be empty",
  }),

  vendorId: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      "any.required": "Vendor ID is required",
      "string.base": "Vendor ID must be a string",
      "string.empty": "Vendor ID cannot be empty",
      "string.pattern.base": "Vendor ID must be a valid MongoDB ObjectId",
    }),

  entryDate: Joi.date().min("now").required().messages({
    "any.required": "Entry date is required",
    "date.base": "Entry date must be a valid date",
    "date.min": "Entry date cannot be in the past",
  }),

  invoiceDate: Joi.date().required().messages({
    "any.required": "Invoice date is required",
    "date.base": "Invoice date must be a valid date",
  }),

  invoiceNumber: Joi.string().required().messages({
    "any.required": "Invoice number is required",
    "string.base": "Invoice number must be a string",
    "string.empty": "Invoice number cannot be empty",
  }),

  poNumber: Joi.string().required().messages({
    "any.required": "PO number is required",
    "string.base": "PO number must be a string",
    "string.empty": "PO number cannot be empty",
  }),

  dueDate: Joi.date().required().messages({
    "any.required": "Due date is required",
    "date.base": "Due date must be a valid date",
  }),

  narration: Joi.string().required().messages({
    "any.required": "Narration is required",
    "string.base": "Narration must be a string",
    "string.empty": "Narration cannot be empty",
  }),

  paymentMode: Joi.string()
    .valid("Cash", "Online", "Cheque")
    .required()
    .messages({
      "any.required": "Payment mode is required",
      "string.base": "Payment mode must be a string",
      "any.only": "Payment mode must be either 'Cash', 'Online' or 'Cheque",
      "string.empty": "Payment mode cannot be empty",
    }),

  chequeNumber: Joi.string().allow(null, "").optional().messages({
    "string.base": "Cheque Number must be a string",
  }),
  transactionNumber: Joi.string().allow(null, "").optional().messages({
    "string.base": "Transaction Number must be a string",
  }),
});

export default {
  PaymentEntryValidator,
};
