import mongoose from "mongoose";

const HeadOfAccountSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    headOfAccountName: {
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

HeadOfAccountSchema.index(
  { schoolId: 1, headOfAccountName: 1, academicYear: 1 },
  { unique: true }
);

export default mongoose.model("HeadOfAccount", HeadOfAccountSchema);
