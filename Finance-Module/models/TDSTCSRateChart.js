import mongoose from "mongoose";

const TDSTCSRateChartSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    TDSorTCS: {
      type: String,
      required: true,
      enum: ["TDS", "TCS"],
    },
    rate: {
      type: Number,
      required: true,
    },
    natureOfTransaction: {
      type: String,
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

TDSTCSRateChartSchema.index(
  {
    schoolId: 1,
    TDSorTCS: 1,
    natureOfTransaction: 1,
    academicYear: 1,
  },
  { unique: true }
);

export default mongoose.model("TDSTCSRateChart", TDSTCSRateChartSchema);
