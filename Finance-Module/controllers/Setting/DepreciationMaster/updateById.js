import DepreciationMaster from "../../../models/DepreciationMaster.js";
import DepreciationMasterValidator from "../../../validators/DepreciationMasterValidator.js";

async function updateById(req, res) {
  try {
    const { id, academicYear } = req.params;
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    // Validate request body
    const { error } =
      DepreciationMasterValidator.DepreciationMasterValidatorUpdate.validate(
        req.body
      );
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    // Extract updated fields
    const { rateAsPerIncomeTaxAct, rateAsPerICAI, ledgerId, groupLedgerId } =
      req.body;

    // Find and update
    const updatedDepreciationMaster = await DepreciationMaster.findOneAndUpdate(
      {
        _id: id,
        schoolId,
        academicYear,
      },
      {
        $set: {
          rateAsPerIncomeTaxAct,
          rateAsPerICAI,
          ledgerId,
          groupLedgerId,
        },
      },
      {
        new: true, // Return the updated document
        runValidators: true, // Ensure schema validation runs
      }
    );

    if (!updatedDepreciationMaster) {
      return res.status(404).json({
        hasError: true,
        message: "Depreciation Master not found.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Depreciation Master updated successfully!",
      data: updatedDepreciationMaster,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Depreciation Master already exists with this combination.`,
      });
    }

    console.error("Error updating Depreciation Master:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
