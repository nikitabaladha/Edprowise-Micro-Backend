import mongoose from "mongoose";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  const [intPart, decimalPart = ""] = value.toString().split(".");
  return parseFloat(intPart + "." + decimalPart.slice(0, 2));
}

const ReceiptSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    receiptVoucherNumber: { type: String },
    customizeEntry: {
      type: Boolean,
      required: true,
      default: false,
    },
    entryDate: { type: Date },
    receiptDate: { type: Date },
    narration: { type: String },
    paymentMode: {
      type: String,
      enum: ["Cash", "Online Net Banking", "Cheque/Bank Account", ""],
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
        amount: {
          type: Number,
          set: toTwoDecimals,
        },
        debitAmount: {
          type: Number,
          set: toTwoDecimals,
        },
      },
    ],
    subTotalAmount: {
      type: Number,
      set: toTwoDecimals,
    },
    subTotalOfDebit: {
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
    TDSTCSRateWithAmount: {
      type: Number,
      set: toTwoDecimals,
    },
    adjustmentValue: {
      type: Number,
      set: toTwoDecimals,
    },
    totalAmount: {
      type: Number,
      set: toTwoDecimals,
    },
    totalDebitAmount: {
      type: Number,
      set: toTwoDecimals,
    },
    receiptImage: {
      type: String,
    },
    chequeImageForReceipt: { type: String },
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

export default mongoose.model("Receipt", ReceiptSchema);
