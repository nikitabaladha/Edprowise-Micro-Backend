import mongoose from "mongoose";

const DepreciationMasterSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    groupLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupLedger",
      required: true,
    },
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
      required: true,
    },
    rateAsPerIncomeTaxAct: {
      type: Number,
      required: true,
    },
    rateAsPerICAI: {
      type: Number,
      required: true,
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

DepreciationMasterSchema.index(
  {
    schoolId: 1,
    groupLedgerId: 1,
    ledgerId: 1,
    academicYear: 1,
  },
  { unique: true }
);

export default mongoose.model("DepreciationMaster", DepreciationMasterSchema);
