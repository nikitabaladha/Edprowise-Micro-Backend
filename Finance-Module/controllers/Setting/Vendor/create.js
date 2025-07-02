import Vendor from "../../../models/Vendor.js";
import VendorValidator from "../../../validators/VendorValidator.js";

async function generateVendorCode(schoolId) {
  const count = await Vendor.countDocuments({ schoolId });
  const nextNumber = count + 1;
  const formattedNumber = String(nextNumber).padStart(3, "0");
  return `VEN-${formattedNumber}`;
}

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to create a Vendor.",
      });
    }

    const { error } = VendorValidator.VendorValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const vendorCode = await generateVendorCode(schoolId);

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

    const newVendor = new Vendor({
      schoolId,
      vendorCode,
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
    });

    await newVendor.save();

    return res.status(201).json({
      hasError: false,
      message: "Vendor created successfully!",
      data: newVendor,
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

    console.error("Error Creating Vendor:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
