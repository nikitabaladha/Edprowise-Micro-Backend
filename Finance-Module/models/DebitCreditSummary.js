import mongoose from "mongoose";

const DebitCreditSummarySchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    financialYear: {
      type: String,
      required: true,
    },
    accountingEntry: { type: String, required: true },
    entryDate: { type: Date },
    itemDetails: [
      {
        ledgerId: {
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

export default mongoose.model("DebitCreditSummary", DebitCreditSummarySchema);
