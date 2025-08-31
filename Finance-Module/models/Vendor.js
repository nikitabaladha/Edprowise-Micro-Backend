import mongoose from "mongoose";

const VendorSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    vendorCode: { type: String, required: true },
    nameOfVendor: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      // unique: true,
    },
    contactNumber: {
      type: String,
      required: true,
      // unique: true,
    },
    panNumber: {
      type: String,
      required: true,
      // unique: true,
    },
    gstNumber: {
      type: String,
      // unique: true,
    },
    address: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    nameOfAccountHolder: {
      type: String,
      required: true,
    },
    nameOfBank: {
      type: String,
      required: true,
    },
    ifscCode: {
      type: String,
      required: true,
    },
    accountNumber: {
      type: String,
      required: true,
    },
    accountType: {
      type: String,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    openingBalance: {
      type: Number,
      default: 0, // Default to 0 if not provided
    },
    paymentTerms: {
      type: Number,
      default: null, // Allow null
    },
    documentImage: {
      type: String,
      default: null, // Allow null
    },
    ledgerId: { type: String },
  },
  {
    timestamps: true,
  }
);

VendorSchema.index(
  { schoolId: 1, vendorCode: 1, nameOfVendor: 1, academicYear: 1 },
  { unique: true }
);

export default mongoose.model("Vendor", VendorSchema);
