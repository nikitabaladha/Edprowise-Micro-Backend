import Contra from "../../../models/Contra.js";

async function deleteById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const existingContra = await Contra.findOne({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!existingContra) {
      return res.status(404).json({
        hasError: true,
        message: "Contra not found.",
      });
    }

    if (existingContra.status !== "Draft") {
      return res.status(400).json({
        hasError: true,
        message: "Only payments with status 'Draft' can be deleted.",
      });
    }

    await Contra.deleteOne({ _id: id });

    return res.status(200).json({
      hasError: false,
      message: "Draft Contra deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting Contra:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteById;
