import mongoose from "mongoose";

const ContraSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    contraEntryName: {
      type: String,
      enum: ["Cash Deposited", "Cash Withdrawn", "Bank Transfer", ""],
    },
    contraVoucherNumber: { type: String, required: true },
    entryDate: { type: Date },
    dateOfCashDepositedWithdrawlDate: { type: Date },
    itemDetails: [
      {
        ledgerId: {
          type: String,
        },
        ledgerIdOfCashAccount: {
          type: String,
        },
        debitAmount: {
          type: Number,
        },
        creditAmount: {
          type: Number,
        },
      },
    ],
    subTotalOfDebit: {
      type: Number,
    },
    subTotalOfCredit: {
      type: Number,
    },
    TDSorTCS: {
      type: String,
      enum: ["TDS", "TCS", ""],
    },
    TDSTCSRateAmount: {
      type: Number,
    },
    totalAmountOfDebit: {
      type: Number,
    },
    totalAmountOfCredit: {
      type: Number,
    },
    narration: { type: String },
    chequeNumber: {
      type: String,
    },
    chequeImageForContra: { type: String },
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

export default mongoose.model("Contra", ContraSchema);
