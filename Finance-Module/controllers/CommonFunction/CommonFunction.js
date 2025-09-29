// Finance-Module/controllers/CommonFunction/createForPayment.js

import mongoose from "mongoose";

export async function hasBankOrCashLedger(schoolId, academicYear, itemDetails) {
  try {
    // Extract all ledger IDs from itemDetails
    const ledgerIds = itemDetails
      .map((item) => item.ledgerId)
      .filter((id) => id);

    if (ledgerIds.length === 0) return false;

    // Fetch ledgers and their group ledger information
    const ledgers = await mongoose
      .model("Ledger")
      .find({
        _id: { $in: ledgerIds },
        schoolId,
        academicYear,
      })
      .populate({
        path: "groupLedgerId",
        select: "groupLedgerName",
      });

    // Check if any ledger has groupLedgerName "Bank" or "Cash"
    return ledgers.some((ledger) => {
      const groupLedgerName = ledger.groupLedgerId?.groupLedgerName;
      return groupLedgerName === "Bank" || groupLedgerName === "Cash";
    });
  } catch (error) {
    console.error("Error checking ledger groups:", error);
    return false;
  }
}
