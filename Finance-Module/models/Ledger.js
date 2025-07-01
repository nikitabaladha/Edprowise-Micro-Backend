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
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

LedgerSchema.index(
  {
    schoolId: 1,
    ledgerName: 1,
    headOfAccountId: 1,
    groupLedgerId: 1,
    bSPLLedgerId: 1,
  },
  { unique: true }
);

export default mongoose.model("Ledger", LedgerSchema);
