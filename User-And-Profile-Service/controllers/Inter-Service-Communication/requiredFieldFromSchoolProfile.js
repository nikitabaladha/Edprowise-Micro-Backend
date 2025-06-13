import School from "../../models/School.js";

async function requiredFieldFromSchoolProfile(req, res) {
  try {
    const school = await School.findOne({
      schoolId: req.params.schoolId,
    }).select(req.query.fields || "");

    if (!school) {
      return res.status(404).json({
        hasError: true,
        message: "School not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "School profile retrieved successfully.",
      data: school,
    });
  } catch (error) {
    console.error("Error retrieving School Profile:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve School Profile.",
      error: error.message,
    });
  }
}

export default requiredFieldFromSchoolProfile;
