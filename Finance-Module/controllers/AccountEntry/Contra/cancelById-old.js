import Contra from "../../../models/Contra.js";

async function cancelById(req, res) {
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

    existingContra.status = "Cancelled";
    await existingContra.save();

    return res.status(200).json({
      hasError: false,
      message: "Contra Cancelled successfully.",
    });
  } catch (error) {
    console.error("Error cancelling Contra:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default cancelById;
