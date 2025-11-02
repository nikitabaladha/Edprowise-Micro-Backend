import DepreciationMaster from "../../../models/DepreciationMaster.js";

async function deleteById(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { id, financialYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const existingDepreciationMaster = await DepreciationMaster.findOne({
      _id: id,
      schoolId,
      financialYear,
    });

    if (!existingDepreciationMaster) {
      return res.status(404).json({
        hasError: true,
        message: "Depreciation Master not found.",
      });
    }

    await DepreciationMaster.deleteOne({ _id: id });

    return res.status(200).json({
      hasError: false,
      message: "Depreciation Master deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting Depreciation Master:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteById;
