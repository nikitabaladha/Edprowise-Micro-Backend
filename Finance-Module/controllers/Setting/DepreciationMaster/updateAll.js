import DepreciationMaster from "../../../models/DepreciationMaster.js";

async function updateAll(req, res) {
  try {
    const { academicYear } = req.params;
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const {
      chargeDepreciation,
      entryAutomation,
      rateAsPerIncomeTaxAct,
      rateAsPerICAI,
      frequency,
    } = req.body;

    const existingDepreciations = await DepreciationMaster.find({
      schoolId,
      academicYear,
    });

    if (!existingDepreciations || existingDepreciations.length === 0) {
      return res.status(404).json({
        hasError: true,
        message: "No Depreciation Master records found for this academic year.",
      });
    }

    const updateFields = {};

    if (chargeDepreciation !== undefined)
      updateFields.chargeDepreciation = chargeDepreciation;
    if (entryAutomation !== undefined)
      updateFields.entryAutomation = entryAutomation;
    if (rateAsPerIncomeTaxAct !== undefined)
      updateFields.rateAsPerIncomeTaxAct = rateAsPerIncomeTaxAct;
    if (rateAsPerICAI !== undefined) updateFields.rateAsPerICAI = rateAsPerICAI;
    if (frequency !== undefined) updateFields.frequency = frequency;

    const result = await DepreciationMaster.updateMany(
      { schoolId, academicYear },
      { $set: updateFields }
    );

    return res.status(200).json({
      hasError: false,
      message: `Depreciation Master records updated successfully! (${result.modifiedCount} records updated)`,
    });
  } catch (error) {
    console.error("Error updating Depreciation Master:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}.`,
      });
    }

    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateAll;
