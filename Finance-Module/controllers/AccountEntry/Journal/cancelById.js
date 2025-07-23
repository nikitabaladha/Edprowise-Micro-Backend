import Journal from "../../../models/Journal.js";

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

    const existingJournal = await Journal.findOne({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!existingJournal) {
      return res.status(404).json({
        hasError: true,
        message: "Journal not found.",
      });
    }

    existingJournal.status = "Cancelled";
    await existingJournal.save();

    return res.status(200).json({
      hasError: false,
      message: "Journal Cancelled successfully.",
    });
  } catch (error) {
    console.error("Error cancelling Journal:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default cancelById;
