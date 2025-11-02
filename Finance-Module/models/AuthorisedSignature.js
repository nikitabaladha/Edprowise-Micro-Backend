import mongoose from "mongoose";

const AuthorisedSignatureSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    authorisedSignatureImage: {
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

AuthorisedSignatureSchema.index(
  { schoolId: 1, financialYear: 1 },
  { unique: true }
);

export default mongoose.model("AuthorisedSignature", AuthorisedSignatureSchema);
