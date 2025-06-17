import School from "../../models/School.js";

async function searchSchools(req, res) {
  const { query } = req.query;

  try {
    const baseCondition = { status: { $in: ["Pending", "Completed"] } };

    const matches = await School.find({
      $or: [
        { schoolName: query, ...baseCondition },
        { schoolId: query, ...baseCondition },
        { schoolEmail: query, ...baseCondition },
        { schoolMobileNo: query, ...baseCondition },
      ],
    });

    return res.json({
      hasError: false,
      data: matches,
    });
  } catch (error) {
    console.error("Error in searchSchools:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error while searching schools",
      error: error.message,
    });
  }
}
export default searchSchools;
