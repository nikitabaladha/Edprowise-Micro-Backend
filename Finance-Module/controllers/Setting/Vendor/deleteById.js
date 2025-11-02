import Vendor from "../../../models/Vendor.js";

async function deleteById(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { id, financialYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const deletedVendor = await Vendor.findOneAndDelete({
      _id: id,
      schoolId,
      financialYear,
    });

    if (!deletedVendor) {
      return res.status(404).json({
        hasError: true,
        message: "Vendor not found or does not belong to your school.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Vendor deleted successfully.",
      data: deletedVendor,
    });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteById;
