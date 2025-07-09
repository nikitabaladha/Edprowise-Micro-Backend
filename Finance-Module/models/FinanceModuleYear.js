import mongoose from "mongoose";

const FinanceModuleYearSchema = new mongoose.Schema(
  {
    schoolId: {
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

export default mongoose.model("FinanceModuleYear", FinanceModuleYearSchema);
