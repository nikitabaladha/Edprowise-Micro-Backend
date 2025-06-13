import User from "../../models/User.js";

async function getUserBySchoolId(req, res) {
  try {
    const user = await User.findOne({
      schoolId: req.params.schoolId,
    }).select(req.query.fields || "");

    if (!user) {
      return res.status(404).json({
        hasError: true,
        message: "User not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "User retrieved successfully.",
      data: user,
    });
  } catch (error) {
    console.error("Error retrieving User:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve User.",
      error: error.message,
    });
  }
}

export default getUserBySchoolId;
