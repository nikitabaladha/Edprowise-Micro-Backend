import mongoose from "mongoose";

const OpeningClosingBalanceSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HeadOfAccount",
      required: true,
    },
    balanceDetails: [
      {
        entryId: { type: String },
        entryDate: { type: Date },
        openingBalance: {
          type: Number,
          default: 0,
        },
        debit: {
          type: Number,
          default: 0,
        },
        credit: {
          type: Number,
          default: 0,
        },
        closingBalance: {
          type: Number,
          default: 0,
        },
      },
    ],

    balanceType: { type: String, enum: ["Debit", "Credit"] },
  },
  {
    timestamps: true,
  }
);

OpeningClosingBalanceSchema.index(
  {
    schoolId: 1,
    ledgerId: 1,
    academicYear: 1,
  },
  { unique: true }
);

export default mongoose.model(
  "OpeningClosingBalance",
  OpeningClosingBalanceSchema
);
