import Ledger from "../../../../models/Ledger.js";

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission to get all Ledger",
      });
    }

    const financialYear = req.params.financialYear;
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
      query.financialYear = financialYear;
    }

    const ledgers = await Ledger.find(query)
      .populate({ path: "headOfAccountId", select: "headOfAccountName" })
      .populate({ path: "groupLedgerId", select: "groupLedgerName" })
      .populate({ path: "bSPLLedgerId", select: "bSPLLedgerName" })
      .sort({ createdAt: -1 });

    // Create a map to deduplicate ledgers based on unique combination
    const ledgerMap = new Map();

    ledgers.forEach((ledger) => {
      // Create a unique key based on ledger properties that should be unique
      const uniqueKey = `${ledger.ledgerName}-${ledger.ledgerCode}-${
        ledger.headOfAccountId?._id || ""
      }-${ledger.groupLedgerId?._id || ""}-${ledger.bSPLLedgerId?._id || ""}`;

      // Only keep the most recent version (since we sorted by createdAt descending)
      if (!ledgerMap.has(uniqueKey)) {
        ledgerMap.set(uniqueKey, ledger);
      }
    });

    // Convert the map values back to an array
    const uniqueLedgers = Array.from(ledgerMap.values());

    const simplifiedLedgers = uniqueLedgers.map((ledger) => ({
      _id: ledger._id,
      schoolId: ledger.schoolId,
      ledgerName: ledger.ledgerName,
      ledgerCode: ledger.ledgerCode,
      openingBalance: ledger.openingBalance,
      balanceType: ledger?.balanceType,
      headOfAccountId: ledger.headOfAccountId?._id ?? null,
      headOfAccountName: ledger.headOfAccountId?.headOfAccountName ?? null,
      groupLedgerId: ledger.groupLedgerId?._id ?? null,
      groupLedgerName: ledger.groupLedgerId?.groupLedgerName ?? null,
      bSPLLedgerId: ledger.bSPLLedgerId?._id ?? null,
      bSPLLedgerName: ledger.bSPLLedgerId?.bSPLLedgerName ?? null,
      createdAt: ledger.createdAt,
      updatedAt: ledger.updatedAt,
    }));

    return res.status(200).json({
      hasError: false,
      message: "Ledgers fetched successfully!",
      data: simplifiedLedgers,
    });
  } catch (error) {
    console.error("Error fetching Ledgers:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
