import DepreciationMaster from "../../../models/DepreciationMaster.js";

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const depreciationRaw = await DepreciationMaster.find({
      schoolId,
      academicYear,
    })
      .populate({
        path: "ledgerId",
        select: "ledgerName ledgerId",
      })
      .populate({
        path: "groupLedgerId",
        select: "groupLedgerName groupLedgerId",
      })
      .sort({ createdAt: -1 });

    // Transform response
    const depreciation = depreciationRaw.map((item) => ({
      _id: item._id,
      schoolId: item.schoolId,
      academicYear: item.academicYear,
      rateAsPerIncomeTaxAct: item.rateAsPerIncomeTaxAct,
      rateAsPerICAI: item.rateAsPerICAI,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      ledgerName: item.ledgerId?.ledgerName || "Not Found",
      groupLedgerName: item.groupLedgerId?.groupLedgerName || "Not Found",
      ledgerId: item.ledgerId?.ledgerId || item.ledgerId?._id || "Not Found",
      groupLedgerId:
        item.groupLedgerId?.groupLedgerId ||
        item.groupLedgerId?._id ||
        "Not Found",
      chargeDepreciation: item.chargeDepreciation,
      entryAutomation: item.entryAutomation,
    }));

    return res.status(200).json({
      hasError: false,
      message: "Depreciation Master fetched successfully!",
      data: depreciation,
    });
  } catch (error) {
    console.error("Error fetching Depreciation Master:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
