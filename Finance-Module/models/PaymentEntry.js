import mongoose from "mongoose";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  const [intPart, decimalPart = ""] = value.toString().split(".");
  return parseFloat(intPart + "." + decimalPart.slice(0, 2));
}

const PaymentEntrySchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    paymentVoucherNumber: { type: String, required: true },
    customizeEntry: {
      type: Boolean,
      required: true,
      default: false,
    },
    vendorCode: { type: String },
    vendorId: {
      type: String,
      ref: "Vendor",
    },
    entryDate: { type: Date },
    invoiceDate: { type: Date },
    invoiceNumber: { type: String },
    poNumber: { type: String },
    dueDate: { type: Date },
    narration: { type: String },
    paymentMode: {
      type: String,
      enum: ["Cash", "Online", "Cheque", ""],
    },
    chequeNumber: {
      type: String,
    },
    transactionNumber: {
      type: String,
    },
    itemDetails: [
      {
        itemName: {
          type: String,
        },
        ledgerId: {
          type: String,
        },
        amountBeforeGST: {
          type: Number,
          set: toTwoDecimals,
        },
        GSTAmount: {
          type: Number,
          set: toTwoDecimals,
        },
        amountAfterGST: {
          type: Number,
          set: toTwoDecimals,
        },
        creditAmount: {
          type: Number,
          set: toTwoDecimals,
        },
      },
    ],
    subTotalAmountAfterGST: {
      type: Number,
      set: toTwoDecimals,
    },
    subTotalOfCredit: {
      type: Number,
      set: toTwoDecimals,
    },
    TDSorTCS: {
      type: String,
      enum: ["TDS", "TCS"],
    },

    TDSorTCSLedgerId: {
      type: String,
    },
    TDSTCSRateChartId: { type: String },
    TDSTCSRate: { type: Number },
    TDSTCSRateWithAmountBeforeGST: {
      type: Number,
      set: toTwoDecimals,
    },
    totalAmountBeforeGST: {
      type: Number,
      set: toTwoDecimals,
    },
    totalGSTAmount: {
      type: Number,
      set: toTwoDecimals,
    },
    totalAmountAfterGST: {
      type: Number,
      set: toTwoDecimals,
    },
    totalCreditAmount: {
      type: Number,
      set: toTwoDecimals,
    },
    invoiceImage: {
      type: String,
    },
    chequeImage: { type: String },
    ledgerIdWithPaymentMode: {
      type: String,
    },
    status: {
      type: String,
      required: true,
      enum: ["Posted", "Draft", "Reversed", "Cancelled"],
    },
    approvalStatus: {
      type: String,
      required: true,
      enum: ["Pending", "Approved", "Disapproved"],
      default: "Pending",
    },
    reasonOfDisapprove: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("PaymentEntry", PaymentEntrySchema);
