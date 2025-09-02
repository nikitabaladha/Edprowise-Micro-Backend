import mongoose from "mongoose";

const JournalSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    journalVoucherNumber: { type: String, required: true },
    customizeEntry: {
      type: Boolean,
      required: true,
      default: false,
    },
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

export default mongoose.model("Journal", JournalSchema);
