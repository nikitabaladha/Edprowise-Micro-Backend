import mongoose from "mongoose";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  const [intPart, decimalPart = ""] = value.toString().split(".");
  return parseFloat(intPart + "." + decimalPart.slice(0, 2));
}

const ContraSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    financialYear: {
      type: String,
      required: true,
    },
    contraEntryName: {
      type: String,
      enum: ["Cash Deposited", "Cash Withdrawn", "Bank Transfer", ""],
      default: "",
    },
    contraVoucherNumber: { type: String },
    customizeEntry: {
      type: Boolean,
      required: true,
      default: false,
    },
    entryDate: { type: Date },
    dateOfCashDepositedWithdrawlDate: { type: Date },
    itemDetails: [
      {
        itemName: {
          type: String,
        },
        ledgerId: {
          type: String,
        },
        ledgerIdOfCashAccount: {
          type: String,
        },
        debitAmount: {
          type: Number,
          set: toTwoDecimals,
        },
        creditAmount: {
          type: Number,
          set: toTwoDecimals,
        },
      },
    ],
    subTotalOfDebit: {
      type: Number,
      set: toTwoDecimals,
    },
    subTotalOfCredit: {
      type: Number,
      set: toTwoDecimals,
    },
    TDSorTCS: {
      type: String,
      enum: ["TDS", "TCS", ""],
    },
    TDSorTCSLedgerId: {
      type: String,
    },
    TDSTCSRateAmount: {
      type: Number,
      set: toTwoDecimals,
    },
    totalAmountOfDebit: {
      type: Number,
      set: toTwoDecimals,
    },
    totalAmountOfCredit: {
      type: Number,
      set: toTwoDecimals,
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

export default mongoose.model("Contra", ContraSchema);
