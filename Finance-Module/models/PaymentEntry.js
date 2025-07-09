import mongoose from "mongoose";

const PaymentEntrySchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    paymentVoucherNumber: { type: String, required: true },
    vendorCode: { type: String, required: true },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    entryDate: { type: Date, required: true },
    invoiceDate: { type: Date, required: true },
    invoiceNumber: { type: String, required: true },
    poNumber: { type: String },
    dueDate: { type: Date, required: true },
    narration: { type: String, required: true },
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
        amountBeforeGST: {
          type: Number,
          required: true,
        },
        GSTAmount: {
          type: Number,
          required: true,
        },
        amountAfterGST: {
          type: Number,
          required: true,
        },
      },
    ],
    subTotalAmountAfterGST: {
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
    TDSTCSRateWithAmountBeforeGST: {
      type: Number,
      required: true,
    },
    adjustmentValue: {
      type: Number,
      required: true,
    },
    totalAmountBeforeGST: {
      type: Number,
      required: true,
    },
    totalGSTAmount: {
      type: Number,
      required: true,
    },
    totalAmountAfterGST: {
      type: Number,
      required: true,
    },
    invoiceImage: {
      type: String,
      required: true,
    },
    chequeImage: {
      type: String,
    },
    ledgerIdWithPaymentMode: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["Posted", "Draft", "Reversed"],
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

export default mongoose.model("PaymentEntry", PaymentEntrySchema);
