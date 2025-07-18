import mongoose from "mongoose";

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
    receiptVoucherNumber: { type: String, required: true },

    entryDate: { type: Date },
    receiptDate: { type: Date },
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
        amount: {
          type: Number,
        },
      },
    ],
    subTotalAmount: {
      type: Number,
    },
    TDSorTCS: {
      type: String,

      enum: ["TDS", "TCS"],
    },
    TDSTCSRateChartId: { type: String },
    TDSTCSRate: { type: Number },
    TDSTCSRateWithAmount: {
      type: Number,
    },
    adjustmentValue: {
      type: Number,
    },
    totalAmount: {
      type: Number,
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Receipt", ReceiptSchema);
