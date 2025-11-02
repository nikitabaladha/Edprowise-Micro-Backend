import DepreciationMaster from "../../../models/DepreciationMaster.js";
import DepreciationMasterValidator from "../../../validators/DepreciationMasterValidator.js";

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    // Validate request body
    const { error } =
      DepreciationMasterValidator.DepreciationMasterValidator.validate(
        req.body
      );

    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    // Extract fields from request body
    const {
      groupLedgerId,
      ledgerId,
      rateAsPerIncomeTaxAct,
      rateAsPerICAI,
      chargeDepreciation,
      entryAutomation,
      financialYear,
    } = req.body;

    // from frontend i will send true or false for them

    // Create new document with all required fields
    const newDepreciationMaster = new DepreciationMaster({
      schoolId,
      groupLedgerId,
      ledgerId,
      rateAsPerIncomeTaxAct,
      rateAsPerICAI,
      chargeDepreciation,
      entryAutomation,
      financialYear,
    });

    await newDepreciationMaster.save();

    return res.status(201).json({
      hasError: false,
      message: "Depreciation Master created successfully!",
      data: newDepreciationMaster,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Depreciation Master already exists.`,
      });
    }

    console.error("Error creating Depreciation Master:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
