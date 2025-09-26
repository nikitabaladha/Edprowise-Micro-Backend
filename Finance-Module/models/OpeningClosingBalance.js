import mongoose from "mongoose";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  // Convert to string → split → cut decimals → join back
  const [intPart, decimalPart = ""] = value.toString().split(".");
  return parseFloat(intPart + "." + decimalPart.slice(0, 2));
}

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
      ref: "Ledger",
      required: true,
    },
    balanceDetails: [
      {
        entryId: { type: String },
        entryDate: { type: Date },
        openingBalance: {
          type: Number,
          default: 0,
          set: toTwoDecimals,
        },
        debit: {
          type: Number,
          default: 0,
          set: toTwoDecimals,
        },
        credit: {
          type: Number,
          default: 0,
          set: toTwoDecimals,
        },
        closingBalance: {
          type: Number,
          default: 0,
          set: toTwoDecimals,
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
