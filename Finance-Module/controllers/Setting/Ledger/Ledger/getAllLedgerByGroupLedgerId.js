import Ledger from "../../../../models/Ledger.js";

async function getAllByGroupLedgerId(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { groupLedgerId, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    if (!groupLedgerId) {
      return res.status(400).json({
        hasError: true,
        message: "Group LedgerId is required.",
      });
    }

    const ledgers = await Ledger.find({
      schoolId,
      groupLedgerId,
      academicYear,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      hasError: false,
      message: "Ledgers fetched successfully!",
      data: ledgers,
    });
  } catch (error) {
    console.error("Error fetching Ledgers:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllByGroupLedgerId;
