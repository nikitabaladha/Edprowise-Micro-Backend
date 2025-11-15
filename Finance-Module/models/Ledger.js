// Finance-Module/models/Ledger.js

import mongoose from "mongoose";

const LedgerSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    headOfAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HeadOfAccount",
      required: true,
    },
    groupLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupLedger",
      required: true,
    },
    bSPLLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BSPLLedger",
      required: true,
    },
    ledgerName: {
      type: String,
      required: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    balanceType: { type: String, enum: ["Debit", "Credit"] },
    paymentMode: {
      type: String,
      enum: [
        "Not Defined",
        "Cash",
        "Online Net Banking",
        "Cheque/Bank Account",
        "",
      ],
      default: "Not Defined",
    },
    ledgerCode: { type: String },
    financialYear: {
      type: String,
      required: true,
    },
    parentLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

LedgerSchema.index(
  {
    schoolId: 1,
    headOfAccountId: 1,
    groupLedgerId: 1,
    bSPLLedgerId: 1,
    ledgerName: 1,
    financialYear: 1,
  },
  { unique: true }
);

export default mongoose.model("Ledger", LedgerSchema);
