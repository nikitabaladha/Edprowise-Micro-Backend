import mongoose from "mongoose";
import FinanceModuleYear from "../../models/FinanceModuleYear.js";
import copyHeadOfAccounts from "../CopyData/copyHeadOfAccounts.js";
import copyBSPLLedgers from "../CopyData/copyBSPLLedger.js";
import copyGroupLedgers from "../CopyData/copyGroupLedger.js";
import copyLedgers from "../CopyData/copyLedger.js";
import copyAuthorisedSignatures from "../CopyData/copyAuthorisedSignature.js";
import copyTDSTCSRateCharts from "../CopyData/copyTDSTCSRateChart.js";
import copyVendors from "../CopyData/copyVendor.js";

export const createFinanceModuleYear = async (req, res) => {
  const session = await mongoose.startSession();
  let transactionCompleted = false;

  try {
    await session.startTransaction();
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

    let { academicYear } = req.body;
    if (/^\d{4}$/.test(academicYear)) {
      const startYear = parseInt(academicYear);
      academicYear = `${startYear}-${startYear + 1}`;
    }

    if (!/^\d{4}-\d{4}$/.test(academicYear)) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        hasError: true,
        message:
          "Invalid academic year format. Please use either YYYY or YYYY-YYYY format.",
      });
    }

    const [startYear, endYear] = academicYear.split("-").map(Number);
    if (endYear - startYear !== 1) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        hasError: true,
        message:
          "Invalid academic year sequence. The second year should be exactly +1 of the first year.",
      });
    }

    const existing = await FinanceModuleYear.findOne({
      schoolId,
      academicYear,
    }).session(session);

    if (existing) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(409).json({
        hasError: true,
        message: `Academic year ${academicYear} already exists for this school.`,
      });
    }

    const prevAcademicYear = `${startYear - 1}-${endYear - 1}`;

    const newYear = new FinanceModuleYear({
      schoolId,
      academicYear,
    });
    await newYear.save({ session });

    const copiedHeadOfAccounts = await copyHeadOfAccounts(
      schoolId,
      academicYear,
      prevAcademicYear,
      session
    );

    const copiedBSPLLedgers = await copyBSPLLedgers(
      schoolId,
      academicYear,
      prevAcademicYear,
      session
    );

    const copiedGroupLedgers = await copyGroupLedgers(
      schoolId,
      academicYear,
      prevAcademicYear,
      session
    );

    const copiedLedgers = await copyLedgers(
      schoolId,
      academicYear,
      prevAcademicYear,
      session
    );

    const copiedAuthorisedSignatures = await copyAuthorisedSignatures(
      schoolId,
      academicYear,
      prevAcademicYear,
      session
    );

    const copiedTDSTCSRateCharts = await copyTDSTCSRateCharts(
      schoolId,
      academicYear,
      prevAcademicYear,
      session
    );

    const copiedVendors = await copyVendors(
      schoolId,
      academicYear,
      prevAcademicYear,
      session
    );

    await session.commitTransaction();
    transactionCompleted = true;

    let message = `Academic year ${academicYear} created successfully`;
    if (copiedHeadOfAccounts > 0) {
      message += ` with ${copiedHeadOfAccounts} head of accounts from ${prevAcademicYear}`;
    }

    if (copiedBSPLLedgers > 0) {
      message += ` with ${copiedBSPLLedgers} BSPL ledgers from ${prevAcademicYear}`;
    }

    if (copiedGroupLedgers > 0) {
      message += ` with ${copiedGroupLedgers} from ${prevAcademicYear}`;
    }

    if (copiedLedgers > 0) {
      message += ` with ${copiedLedgers} from ${prevAcademicYear}`;
    }

    if (copiedAuthorisedSignatures > 0) {
      message += ` with ${copiedAuthorisedSignatures} from ${prevAcademicYear}`;
    }

    if (copiedTDSTCSRateCharts > 0) {
      message += ` with ${copiedTDSTCSRateCharts} from ${prevAcademicYear}`;
    }

    if (copiedVendors > 0) {
      message += ` with ${copiedVendors} from ${prevAcademicYear}`;
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
      let errorYear = req.body.academicYear;
      if (/^\d{4}$/.test(errorYear)) {
        const startYear = parseInt(errorYear);
        errorYear = `${startYear}-${startYear + 1}`;
      }

      return res.status(409).json({
        hasError: true,
        message: `Academic year ${errorYear} already exists for this school.`,
      });
    }

    // Handle other errors
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
