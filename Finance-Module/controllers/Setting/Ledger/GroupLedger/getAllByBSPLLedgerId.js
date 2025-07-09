import GroupLedger from "../../../../models/GroupLedger.js";

async function getAllByBSPLLedgerId(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { bSPLLedgerId, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    if (!bSPLLedgerId) {
      return res.status(400).json({
        hasError: true,
        message: "B/S & P&L LedgerId is required.",
      });
    }

    const ledgers = await GroupLedger.find({
      schoolId,
      bSPLLedgerId,
      academicYear,
    }).sort({
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

export default getAllByBSPLLedgerId;
