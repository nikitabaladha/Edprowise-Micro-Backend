import mongoose from "mongoose";

const VerificationCodeSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

export default mongoose.model("VerificationCode", VerificationCodeSchema);
