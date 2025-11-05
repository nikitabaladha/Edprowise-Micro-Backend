// Finance-Module/models/FinanceModuleYear.js

import mongoose from "mongoose";

const FinanceModuleYearSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    financialYear: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("FinanceModuleYear", FinanceModuleYearSchema);
