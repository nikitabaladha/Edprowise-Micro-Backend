import GroupLedger from "../../../../models/GroupLedger.js";

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const { financialYear } = req.params;

    const ledgers = await GroupLedger.find({ schoolId, financialYear }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      hasError: false,
      message: "Group Ledgers fetched successfully!",
      data: ledgers,
    });
  } catch (error) {
    console.error("Error fetching Group Ledgers:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
