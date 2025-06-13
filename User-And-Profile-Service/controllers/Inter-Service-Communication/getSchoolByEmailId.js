import School from "../../models/School.js";

async function getSchoolByEmailId(req, res) {
  try {
    const { schoolEmail } = req.params;
    const { fields } = req.query;

    if (!schoolEmail) {
      return res.status(400).json({
        hasError: true,
        message: "schoolEmail is required",
      });
    }

    const school = await School.findOne({ schoolEmail }).select(fields || "");

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

export default getSchoolByEmailId;
