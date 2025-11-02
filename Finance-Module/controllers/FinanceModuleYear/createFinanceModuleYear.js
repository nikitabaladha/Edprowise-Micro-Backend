import mongoose from "mongoose";
import FinanceModuleYear from "../../models/FinanceModuleYear.js";
import copyHeadOfAccounts from "../CopyData/copyHeadOfAccounts.js";
import copyBSPLLedgers from "../CopyData/copyBSPLLedger.js";
import copyGroupLedgers from "../CopyData/copyGroupLedger.js";
import copyLedgers from "../CopyData/copyLedger.js";
import copyAuthorisedSignatures from "../CopyData/copyAuthorisedSignature.js";
import copyTDSTCSRateCharts from "../CopyData/copyTDSTCSRateChart.js";
import copyVendors from "../CopyData/copyVendor.js";
import copyTotalNetdeficitNetSurplus from "../CopyData/copyTotalNetdeficitNetSurplus.js";

import HeadOfAccount from "../../models/HeadOfAccount.js";
import BSPLLedger from "../../models/BSPLLedger.js";
import GroupLedger from "../../models/GroupLedger.js";
import Ledger from "../../models/Ledger.js";
import AuthorisedSignature from "../../models/AuthorisedSignature.js";
import TDSTCSRateChart from "../../models/TDSTCSRateChart.js";
import Vendor from "../../models/Vendor.js";
import TotalNetdeficitNetSurplus from "../../models/TotalNetdeficitNetSurplus.js";

export const createFinanceModuleYear = async (req, res) => {
  const session = await mongoose.startSession();
  let transactionCompleted = false;

  try {
    // Start transaction with increased timeout and proper settings
    await session.startTransaction({
      maxTimeMS: 120000, // 2 minutes timeout
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });

    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to create academic year data.",
      });
    }

    let { financialYear } = req.body;
    if (/^\d{4}$/.test(financialYear)) {
      const startYear = parseInt(financialYear);
      financialYear = `${startYear}-${startYear + 1}`;
    }

    if (!/^\d{4}-\d{4}$/.test(financialYear)) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        hasError: true,
        message:
          "Invalid academic year format. Please use either YYYY or YYYY-YYYY format.",
      });
    }

    const [startYear, endYear] = financialYear.split("-").map(Number);
    if (endYear - startYear !== 1) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        hasError: true,
        message:
          "Invalid academic year sequence. The second year should be exactly +1 of the first year.",
      });
    }

    // Check for existing data sequentially to reduce transaction load
    const existingYear = await FinanceModuleYear.findOne({
      schoolId,
      financialYear,
    }).session(session);

    if (existingYear) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(409).json({
        hasError: true,
        message: `Academic year ${financialYear} already exists for this school.`,
      });
    }

    // Check other collections sequentially
    const existingCollections = [];

    if (
      await HeadOfAccount.exists({ schoolId, financialYear }).session(session)
    ) {
      existingCollections.push("Head of Accounts");
    }
    if (await BSPLLedger.exists({ schoolId, financialYear }).session(session)) {
      existingCollections.push("BSPL Ledgers");
    }
    if (
      await GroupLedger.exists({ schoolId, financialYear }).session(session)
    ) {
      existingCollections.push("Group Ledgers");
    }
    if (await Ledger.exists({ schoolId, financialYear }).session(session)) {
      existingCollections.push("Ledgers");
    }
    if (
      await AuthorisedSignature.exists({ schoolId, financialYear }).session(
        session
      )
    ) {
      existingCollections.push("Authorised Signatures");
    }
    if (
      await TDSTCSRateChart.exists({ schoolId, financialYear }).session(session)
    ) {
      existingCollections.push("TDS/TCS Rate Charts");
    }
    if (await Vendor.exists({ schoolId, financialYear }).session(session)) {
      existingCollections.push("Vendors");
    }

    if (
      await TotalNetdeficitNetSurplus.exists({
        schoolId,
        financialYear,
      }).session(session)
    ) {
      existingCollections.push("TotalNetdeficitNetSurplus");
    }

    if (existingCollections.length > 0) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(409).json({
        hasError: true,
        message: `Cannot create year ${financialYear}. The following data already exists: ${existingCollections.join(
          ", "
        )}.`,
      });
    }

    const prevFinancialYear = `${startYear - 1}-${endYear - 1}`;

    // Create the main FinanceModuleYear record first
    const newYear = new FinanceModuleYear({
      schoolId,
      financialYear,
    });
    await newYear.save({ session });

    // Execute copy operations sequentially with error handling for each
    let copiedHeadOfAccounts = 0;
    let copiedBSPLLedgers = 0;
    let copiedGroupLedgers = 0;
    let copiedLedgers = 0;
    let copiedAuthorisedSignatures = 0;
    let copiedTDSTCSRateCharts = 0;
    let copiedVendors = 0;
    let copiedTotalNetdeficitNetSurplus = 0;

    try {
      copiedHeadOfAccounts = await copyHeadOfAccounts(
        schoolId,
        financialYear,
        prevFinancialYear,
        session
      );
      console.log(`Copied ${copiedHeadOfAccounts} Head of Accounts`);
    } catch (error) {
      console.error("Error copying Head of Accounts:", error);
      throw error;
    }

    try {
      copiedBSPLLedgers = await copyBSPLLedgers(
        schoolId,
        financialYear,
        prevFinancialYear,
        session
      );
      console.log(`Copied ${copiedBSPLLedgers} BSPL Ledgers`);
    } catch (error) {
      console.error("Error copying BSPL Ledgers:", error);
      throw error;
    }

    try {
      copiedGroupLedgers = await copyGroupLedgers(
        schoolId,
        financialYear,
        prevFinancialYear,
        session
      );
      console.log(`Copied ${copiedGroupLedgers} Group Ledgers`);
    } catch (error) {
      console.error("Error copying Group Ledgers:", error);
      throw error;
    }

    try {
      copiedLedgers = await copyLedgers(
        schoolId,
        financialYear,
        prevFinancialYear,
        session
      );
      console.log(`Copied ${copiedLedgers} Ledgers`);
    } catch (error) {
      console.error("Error copying Ledgers:", error);
      throw error;
    }

    try {
      copiedAuthorisedSignatures = await copyAuthorisedSignatures(
        schoolId,
        financialYear,
        prevFinancialYear,
        session
      );
      console.log(`Copied ${copiedAuthorisedSignatures} Authorised Signatures`);
    } catch (error) {
      console.error("Error copying Authorised Signatures:", error);
      throw error;
    }

    try {
      copiedTDSTCSRateCharts = await copyTDSTCSRateCharts(
        schoolId,
        financialYear,
        prevFinancialYear,
        session
      );
      console.log(`Copied ${copiedTDSTCSRateCharts} TDS/TCS Rate Charts`);
    } catch (error) {
      console.error("Error copying TDS/TCS Rate Charts:", error);
      throw error;
    }

    try {
      copiedVendors = await copyVendors(
        schoolId,
        financialYear,
        prevFinancialYear,
        session
      );
      console.log(`Copied ${copiedVendors} Vendors`);
    } catch (error) {
      console.error("Error copying Vendors:", error);
      throw error;
    }

    try {
      copiedTotalNetdeficitNetSurplus = await copyTotalNetdeficitNetSurplus(
        schoolId,
        financialYear,
        prevFinancialYear,
        session
      );
      console.log(`Copied ${copiedTotalNetdeficitNetSurplus} Vendors`);
    } catch (error) {
      console.error("Error copying TotalNetdeficitNetSurplus:", error);
      throw error;
    }

    // Commit the transaction
    await session.commitTransaction();
    transactionCompleted = true;

    let message = `Academic year ${financialYear} created successfully`;
    if (copiedHeadOfAccounts > 0) {
      message += ` with ${copiedHeadOfAccounts} head of accounts from ${prevFinancialYear}`;
    }

    if (copiedBSPLLedgers > 0) {
      message += ` with ${copiedBSPLLedgers} BSPL ledgers from ${prevFinancialYear}`;
    }

    if (copiedGroupLedgers > 0) {
      message += ` with ${copiedGroupLedgers} group ledgers from ${prevFinancialYear}`;
    }

    if (copiedLedgers > 0) {
      message += ` with ${copiedLedgers} ledgers from ${prevFinancialYear}`;
    }

    if (copiedAuthorisedSignatures > 0) {
      message += ` with ${copiedAuthorisedSignatures} authorised signatures from ${prevFinancialYear}`;
    }

    if (copiedTDSTCSRateCharts > 0) {
      message += ` with ${copiedTDSTCSRateCharts} TDS/TCS rate charts from ${prevFinancialYear}`;
    }

    if (copiedVendors > 0) {
      message += ` with ${copiedVendors} vendors from ${prevFinancialYear}`;
    }

    if (copiedTotalNetdeficitNetSurplus > 0) {
      message += ` with ${copiedTotalNetdeficitNetSurplus} TotalNetdeficitNetSurplus from ${prevFinancialYear}`;
    }

    return res.status(201).json({
      hasError: false,
      message,
      data: {
        newYear,
        copiedHeadOfAccounts,
        copiedBSPLLedgers,
        copiedGroupLedgers,
        copiedLedgers,
        copiedAuthorisedSignatures,
        copiedTDSTCSRateCharts,
        copiedVendors,
        copiedTotalNetdeficitNetSurplus,
      },
    });
  } catch (error) {
    if (!transactionCompleted) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Error aborting transaction:", abortError);
      }
    }

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      const duplicateValue = error.keyValue
        ? error.keyValue[duplicateField]
        : null;

      let collectionName = "";
      if (error.message.includes("financemoduleyears"))
        collectionName = "Finance Module Year";
      else if (error.message.includes("headofaccounts"))
        collectionName = "Head of Accounts";
      else if (error.message.includes("bsplledgers"))
        collectionName = "BSPL Ledgers";
      else if (error.message.includes("groupledgers"))
        collectionName = "Group Ledgers";
      else if (error.message.includes("ledgers")) collectionName = "Ledgers";
      else if (error.message.includes("authorisedsignatures"))
        collectionName = "Authorised Signatures";
      else if (error.message.includes("tdstcsratecharts"))
        collectionName = "TDS/TCS Rate Charts";
      else if (error.message.includes("vendors")) collectionName = "Vendors";
      else if (error.message.includes("TotalNetdeficitNetSurplus"))
        collectionName = "TotalNetdeficitNetSurplus";
      else collectionName = "Unknown Collection";

      let message = `Duplicate data found in ${collectionName}`;
      if (duplicateField && duplicateValue) {
        message += ` — field "${duplicateField}" with value "${duplicateValue}" already exists.`;
      }

      return res.status(409).json({
        hasError: true,
        message,
      });
    }

    console.error("Error creating Finance Module Year:", error);
    return res.status(500).json({
      hasError: true,
      message: "Server error while saving academic year.",
      error: error.message,
    });
  } finally {
    try {
      await session.endSession();
    } catch (endSessionError) {
      console.error("Error ending session:", endSessionError);
    }
  }
};

export default createFinanceModuleYear;
