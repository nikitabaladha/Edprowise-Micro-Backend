import mongoose from "mongoose";

const AuditorDocumentSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    ledgerId: {
      type: String,
    },
    itemDetails: [
      {
        auditorDocument: {
          type: String,
        },
        remark: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

AuditorDocumentSchema.index(
  {
    schoolId: 1,
    ledgerId: 1,
    academicYear: 1,
  },
  { unique: true }
);

export default mongoose.model("AuditorDocument", AuditorDocumentSchema);
