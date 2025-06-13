import School from "../../models/School.js";

async function getAllSchoolWithRequiredFields(req, res) {
  try {
    const schools = await School.find().select(req.query.fields || "");

    if (!schools) {
      return res.status(404).json({
        hasError: true,
        message: "Schools not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Schools retrieved successfully.",
      data: admins,
    });
  } catch (error) {
    console.error("Error retrieving Schools:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve Schools",
      error: error.message,
    });
  }
}

export default getAllSchoolWithRequiredFields;
