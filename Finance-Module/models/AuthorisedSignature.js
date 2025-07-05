import mongoose from "mongoose";

const AuthorisedSignatureSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
      unique: true,
    },
    authorisedSignatureImage: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("AuthorisedSignature", AuthorisedSignatureSchema);
