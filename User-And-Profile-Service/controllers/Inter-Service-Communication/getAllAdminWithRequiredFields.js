import AdminUser from "../../models/AdminUser.js";

async function getAllAdminWithRequiredFields(req, res) {
  try {
    const admins = await AdminUser.find().select(req.query.fields || "");

    if (!admins) {
      return res.status(404).json({
        hasError: true,
        message: "Admins not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Admins retrieved successfully.",
      data: admins,
    });
  } catch (error) {
    console.error("Error retrieving Edprowise Admins:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve Edprowise Admins.",
      error: error.message,
    });
  }
}

export default getAllAdminWithRequiredFields;
