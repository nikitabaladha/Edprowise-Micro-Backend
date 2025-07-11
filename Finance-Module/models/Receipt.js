import mongoose from "mongoose";

const ReceiptSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    receiptDate: { type: Date },
    entryDate: { type: Date },
    narration: { type: String },
    receiptImage: {
      type: String,
    },
    chequeImage: {
      type: String,
    },
    paymentMode: {
      type: String,
      enum: ["Cash", "Online", "Cheque"],
    },
    chequeNumber: {
      type: String,
    },
    transactionNumber: {
      type: String,
    },
    receiptVoucherNumber: { type: String },
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
    ledgerIdWithPaymentMode: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Posted", "Draft", "Reversed", "Cancelled"],
    },
    academicYear: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Receipt", ReceiptSchema);
