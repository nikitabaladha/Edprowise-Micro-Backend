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

export const createFinanceModuleYear = async (req, res) => {
  const session = await mongoose.startSession();
  let transactionCompleted = false;

  try {
    await session.startTransaction({
      maxTimeMS: 120000,
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

    // Check for existing year
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

    const prevFinancialYear = `${startYear - 1}-${endYear - 1}`;

    // Check if previous year data exists FIRST
    const hasPreviousYearData = await FinanceModuleYear.findOne({
      schoolId,
      financialYear: prevFinancialYear,
    }).session(session);

    // Create the main FinanceModuleYear record with appropriate flags
    const newYear = new FinanceModuleYear({
      schoolId,
      financialYear,
      isDataCopiedFromPreviousYear: !!hasPreviousYearData, // ✅ FIXED: Convert to boolean
    });

    // Save with session - this will trigger the pre-save hook only if not copying data
    await newYear.save({ session });

    let copiedHeadOfAccounts = 0;
    let copiedBSPLLedgers = 0;
    let copiedGroupLedgers = 0;
    let copiedLedgers = 0;
    let copiedAuthorisedSignatures = 0;
    let copiedTDSTCSRateCharts = 0;
    let copiedVendors = 0;
    let copiedTotalNetdeficitNetSurplus = 0;

    if (hasPreviousYearData) {
      // COPY FROM PREVIOUS YEAR
      console.log(`Copying data from previous year: ${prevFinancialYear}`);

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
        console.log(
          `Copied ${copiedAuthorisedSignatures} Authorised Signatures`
        );
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
        console.log(
          `Copied ${copiedTotalNetdeficitNetSurplus} TotalNetdeficitNetSurplus`
        );
      } catch (error) {
        console.error("Error copying TotalNetdeficitNetSurplus:", error);
        throw error;
      }

      // Update the flag to indicate default accounts are now created (via copy)
      newYear.isDefaultAccountsCreated = true;
      await newYear.save({ session });
    } else {
      // DEFAULT ACCOUNTS ARE ALREADY CREATED BY PRE-SAVE HOOK (if no previous data)
      console.log(
        `No previous year data found. Default accounts will be created automatically for: ${financialYear}`
      );

      // Set counters to indicate default accounts were created
      copiedHeadOfAccounts = -1;
      copiedBSPLLedgers = -1;
      copiedGroupLedgers = -1;
      copiedLedgers = -1;
    }

    // Commit the transaction
    await session.commitTransaction();
    transactionCompleted = true;

    let message = `Academic year ${financialYear} created successfully`;

    if (hasPreviousYearData) {
      // Message for copied data
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
    } else {
      // Message for default accounts
      message += ` with default chart of accounts`;
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
        dataSource: hasPreviousYearData ? "previous_year" : "default_accounts",
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
      // Handle duplicate key errors gracefully
      console.log("Duplicate data detected, but continuing:", error.message);

      // You can choose to continue or return a specific message
      return res.status(409).json({
        hasError: true,
        message:
          "Some data already exists for this financial year. Please try again or contact support.",
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
