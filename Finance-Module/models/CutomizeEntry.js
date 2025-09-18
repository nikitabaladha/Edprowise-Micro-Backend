import mongoose from "mongoose";

const CutomizeEntrySchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    accountingEntry: {
      type: String,
      required: true,
      enum: ["Payment", "Receipt", "Contra", "Journal"],
    },
    entryVoucherNumber: { type: String, required: true },
    entryDate: { type: Date },
    documentDate: { type: Date },
    itemDetails: [
      {
        ledgerId: {
          type: String,
        },
        description: {
          type: String,
        },
        debitAmount: {
          type: Number,
          min: 0,
        },
        creditAmount: {
          type: Number,
          min: 0,
        },
      },
    ],
    subTotalOfDebit: {
      type: Number,
    },
    subTotalOfCredit: {
      type: Number,
    },
    totalAmountOfDebit: {
      type: Number,
    },
    totalAmountOfCredit: {
      type: Number,
    },
    documentImage: {
      type: String,
    },
    narration: { type: String },
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

export default mongoose.model("CutomizeEntry", CutomizeEntrySchema);
