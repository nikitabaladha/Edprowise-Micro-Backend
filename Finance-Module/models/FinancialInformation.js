import mongoose from "mongoose";

const FinancialInformationSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    paymentTerms: { type: Number },
    documentImage: { type: String },
  },
  {
    timestamps: true,
  }
);

FinancialInformationSchema.index(
  {
    schoolId: 1,
    academicYear: 1,
  },
  { unique: true }
);

export default mongoose.model(
  "FinancialInformation",
  FinancialInformationSchema
);
