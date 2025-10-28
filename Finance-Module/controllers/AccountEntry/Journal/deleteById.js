import Journal from "../../../models/Journal.js";

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

    if (existingJournal.status !== "Draft") {
      return res.status(400).json({
        hasError: true,
        message: "Only payments with status 'Draft' can be deleted.",
      });
    }

    await Journal.deleteOne({ _id: id });

    return res.status(200).json({
      hasError: false,
      message: "Draft Journal deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting Journal:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteById;
