import mongoose from "mongoose";

const GroupLedgerSchema = new mongoose.Schema(
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
    bSPLLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BSPLLedger",
      required: true,
    },
    groupLedgerName: {
      type: String,
      required: true,
    },
    financialYear: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

GroupLedgerSchema.index(
  {
    schoolId: 1,
    headOfAccountId: 1,
    bSPLLedgerId: 1,
    groupLedgerName: 1,
    financialYear: 1,
  },
  { unique: true }
);

export default mongoose.model("GroupLedger", GroupLedgerSchema);
