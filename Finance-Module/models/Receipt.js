import mongoose from "mongoose";

const ReceiptSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    receiptDate: { type: Date, required: true },
    entryDate: { type: Date, required: true },
    narration: { type: String, required: true },
    receiptImage: {
      type: String,
      required: true,
    },
    chequeImage: {
      type: String,
    },
    paymentMode: {
      type: String,
      required: true,
      enum: ["Cash", "Online", "Cheque"],
    },
    chequeNumber: {
      type: String,
    },
    transactionNumber: {
      type: String,
    },
    receiptVoucherNumber: { type: String, required: true },
    itemDetails: [
      {
        itemName: {
          type: String,
          required: true,
        },
        ledgerId: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],
    subTotalAmount: {
      type: Number,
      required: true,
    },
    TDSorTCS: {
      type: String,
      required: true,
      enum: ["TDS", "TCS"],
    },
    TDSTCSRateChartId: { type: String, required: true },
    TDSTCSRate: { type: Number, required: true },
    TDSTCSRateWithAmount: {
      type: Number,
      required: true,
    },
    adjustmentValue: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    ledgerIdWithPaymentMode: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
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
