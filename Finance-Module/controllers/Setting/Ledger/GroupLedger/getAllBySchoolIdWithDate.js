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

    const { academicYear } = req.params;
    const { startDate, endDate } = req.query;

    // Build the query object
    let query = { schoolId };

    // If date range is provided, filter by createdAt date
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      // If no date range, filter by academic year
      query.academicYear = academicYear;
    }

    const ledgers = await GroupLedger.find(query).sort({
      createdAt: -1,
    });

    const uniqueLedgers = [];
    const seenGroups = new Set();

    ledgers.forEach((ledger) => {
      const groupKey = `${ledger.headOfAccountId}_${ledger.bSPLLedgerId}_${ledger.groupLedgerName}_${ledger.academicYear}`;

      if (!seenGroups.has(groupKey)) {
        uniqueLedgers.push(ledger);
        seenGroups.add(groupKey);
      }
    });

    return res.status(200).json({
      hasError: false,
      message: "Group Ledgers fetched successfully!",
      data: uniqueLedgers,
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
