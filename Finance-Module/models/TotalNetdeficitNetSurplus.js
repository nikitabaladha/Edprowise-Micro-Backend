import mongoose from "mongoose";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  // Convert to string → split → cut decimals → join back
  const [intPart, decimalPart = ""] = value.toString().split(".");
  return parseFloat(intPart + "." + decimalPart.slice(0, 2));
}

const TotalNetdeficitNetSurplusSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    balanceDetails: [
      {
        entryId: { type: String },
        entryDate: { type: Date },
        incomeBalance: {
          type: Number,
          default: 0,
          set: toTwoDecimals,
        },
        expensesBalance: {
          type: Number,
          default: 0,
          set: toTwoDecimals,
        },
        totalBalance: {
          type: Number,
          default: 0,
          set: toTwoDecimals,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

TotalNetdeficitNetSurplusSchema.index(
  {
    schoolId: 1,
    ledgerId: 1,
    academicYear: 1,
  },
  { unique: true }
);

export default mongoose.model(
  "TotalNetdeficitNetSurplus",
  TotalNetdeficitNetSurplusSchema
);
