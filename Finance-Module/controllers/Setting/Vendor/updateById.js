import Vendor from "../../../models/Vendor.js";
import VendorValidator from "../../../validators/VendorValidator.js";

async function updateById(req, res) {
  try {
    const { id } = req.params;

    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to update a ledger.",
      });
    }

    const { error } = VendorValidator.VendorValidator.validate(req.body);
    if (error?.details?.length) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

    const {
      nameOfVendor,
      email,
      contactNumber,
      panNumber,
      gstNumber,
      address,
      state,
      nameOfAccountHolder,
      nameOfBank,
      ifscCode,
      accountNumber,
      accountType,
    } = req.body;

    const existingVendor = await Vendor.findOne({ _id: id, schoolId });
    if (!existingVendor) {
      return res.status(404).json({
        hasError: true,
        message: "Vendor not found.",
      });
    }

    existingVendor.nameOfVendor = nameOfVendor || existingVendor.nameOfVendor;
    existingVendor.email = email || existingVendor.email;
    existingVendor.contactNumber =
      contactNumber || existingVendor.contactNumber;
    existingVendor.panNumber = panNumber || existingVendor.panNumber;
    existingVendor.gstNumber = gstNumber || existingVendor.gstNumber;
    existingVendor.address = address || existingVendor.address;
    existingVendor.state = state || existingVendor.state;
    existingVendor.nameOfAccountHolder =
      nameOfAccountHolder || existingVendor.nameOfAccountHolder;
    existingVendor.nameOfBank = nameOfBank || existingVendor.nameOfBank;
    existingVendor.ifscCode = ifscCode || existingVendor.ifscCode;
    existingVendor.accountNumber =
      accountNumber || existingVendor.accountNumber;
    existingVendor.accountType = accountType || existingVendor.accountType;

    await existingVendor.save();

    return res.status(200).json({
      hasError: false,
      message: "Vendor updated successfully!",
      data: existingVendor,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Vendor already exists.`,
      });
    }

    console.error("Error updating Vendor:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
