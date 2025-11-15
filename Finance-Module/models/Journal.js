import mongoose from "mongoose";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  const [intPart, decimalPart = ""] = value.toString().split(".");
  return parseFloat(intPart + "." + decimalPart.slice(0, 2));
}

const JournalSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    financialYear: {
      type: String,
      required: true,
    },
    journalVoucherNumber: { type: String },
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
          set: toTwoDecimals,
        },
        creditAmount: {
          type: Number,
          min: 0,
          set: toTwoDecimals,
        },
      },
    ],
    subTotalOfDebit: {
      type: Number,
      set: toTwoDecimals,
    },
    subTotalOfCredit: {
      type: Number,
      set: toTwoDecimals,
    },
    totalAmountOfDebit: {
      type: Number,
      set: toTwoDecimals,
    },
    totalAmountOfCredit: {
      type: Number,
      set: toTwoDecimals,
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
    approvalStatus: {
      type: String,
      required: true,
      enum: ["Pending", "Approved", "Disapproved"],
      default: "Pending",
    },
    reasonOfDisapprove: {
      type: String,
    },
    sourceModule: {
      type: String,
      enum: ["Finance", "Fees"],
      default: "Finance",
    },
    isRefund: {
      type: Boolean,
      default: false,
    },
    refundType: {
      type: String,
      enum: [
        "Registration",
        "Admission",
        "TC",
        "Board Registration",
        "Board Exam",
        "School Fees",
      ],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Journal", JournalSchema);
