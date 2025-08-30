import mongoose from "mongoose";

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
        },
        GSTAmount: {
          type: Number,
        },
        amountAfterGST: {
          type: Number,
        },
      },
    ],
    subTotalAmountAfterGST: {
      type: Number,
    },
    TDSorTCS: {
      type: String,
      enum: ["TDS", "TCS"],
    },
    TDSTCSRateChartId: { type: String },
    TDSTCSRate: { type: Number },
    TDSTCSRateWithAmountBeforeGST: {
      type: Number,
    },

    totalAmountBeforeGST: {
      type: Number,
    },
    totalGSTAmount: {
      type: Number,
    },
    totalAmountAfterGST: {
      type: Number,
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("PaymentEntry", PaymentEntrySchema);
