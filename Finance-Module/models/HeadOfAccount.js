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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("HeadOfAccount", HeadOfAccountSchema);
