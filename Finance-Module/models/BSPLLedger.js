import mongoose from "mongoose";

const BSPLLedgerSchema = new mongoose.Schema(
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
    bSPLLedgerName: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

BSPLLedgerSchema.index(
  { schoolId: 1, headOfAccountId: 1, bSPLLedgerName: 1 },
  { unique: true }
);

export default mongoose.model("BSPLLedger", BSPLLedgerSchema);
