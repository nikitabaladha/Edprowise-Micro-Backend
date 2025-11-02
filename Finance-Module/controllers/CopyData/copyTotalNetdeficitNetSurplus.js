import Ledger from "../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../models/TotalNetdeficitNetSurplus.js";

const copyTotalNetdeficitNetSurplus = async (
  schoolId,
  newFinancialYear,
  prevFinancialYear,
  session
) => {
  // Find the previous year's TotalNetdeficitNetSurplus record
  const previousTotalNetdeficitNetSurplus =
    await TotalNetdeficitNetSurplus.findOne({
      schoolId,
      financialYear: prevFinancialYear,
    }).session(session);

  if (!previousTotalNetdeficitNetSurplus) {
    return 0; // No previous record found
  }

  // Find the newly created Net Surplus/(Deficit) ledger for the new academic year
  const newNetSurplusDeficitLedger = await Ledger.findOne({
    schoolId,
    financialYear: newFinancialYear,
    ledgerName: "Net Surplus/(Deficit)",
  }).session(session);

  if (!newNetSurplusDeficitLedger) {
    console.log("Net Surplus/(Deficit) ledger not found for new academic year");
    return 0;
  }

  // Check if TotalNetdeficitNetSurplus record already exists for new academic year
  const existingRecord = await TotalNetdeficitNetSurplus.findOne({
    schoolId,
    financialYear: newFinancialYear,
  }).session(session);

  if (existingRecord) {
    console.log(
      "TotalNetdeficitNetSurplus record already exists for new academic year"
    );
    return 0;
  }

  // Create new TotalNetdeficitNetSurplus record for the new academic year
  const newTotalNetdeficitNetSurplus = new TotalNetdeficitNetSurplus({
    schoolId,
    financialYear: newFinancialYear,
    ledgerId: newNetSurplusDeficitLedger._id, // Use the new ledger ID
    balanceDetails: [], // Start with empty balance details for new year
  });

  await newTotalNetdeficitNetSurplus.save({ session });

  console.log(
    `Created TotalNetdeficitNetSurplus record for academic year ${newFinancialYear}`
  );
  return 1; // Return 1 since we created one record
};

export default copyTotalNetdeficitNetSurplus;
