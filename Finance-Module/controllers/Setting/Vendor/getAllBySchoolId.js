import Vendor from "../../../models/Vendor.js";

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const vendors = await Vendor.find({ schoolId, academicYear }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      hasError: false,
      message: "Vendors fetched successfully.",
      data: vendors,
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
