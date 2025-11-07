// Fees-Module/controllers/Inter-Service-Communication/DailyBatchRefundScheduler.js
import cron from "node-cron";
import axios from "axios";
import mongoose from "mongoose";
import RefundFees from "../../models/RefundFees.js";

function normalizeDateToUTCStartOfDay(date) {
  const newDate = new Date(date);
  return new Date(
    Date.UTC(
      newDate.getUTCFullYear(),
      newDate.getUTCMonth(),
      newDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

// Get all unique school IDs from refund table
async function getAllSchoolIdsFromRefunds() {
  try {
    const schoolIds = await RefundFees.distinct("schoolId", {
      status: { $in: ["Refund", "Cancelled", "Cheque Return"] }, // FIXED: Added "Cheque Return"
      isProcessedInFinance: { $ne: true },
      $or: [
        { refundAmount: { $gt: 0 } },
        { cancelledAmount: { $gt: 0 } },
        { balance: { $gt: 0 } },
      ],
    });

    console.log(`Found ${schoolIds.length} schools with unprocessed refunds`);
    return schoolIds;
  } catch (error) {
    console.error("Error getting school IDs from refunds:", error);
    return [];
  }
}

// Get academic year for a school from refund records
async function getAcademicYearForSchoolFromRefunds(schoolId) {
  try {
    const refund = await RefundFees.findOne({
      schoolId,
      status: { $in: ["Refund", "Cancelled", "Cheque Return"] },
      $or: [
        { refundAmount: { $gt: 0 } },
        { cancelledAmount: { $gt: 0 } },
        { balance: { $gt: 0 } },
      ],
    });

    if (refund && refund.academicYear) {
      return refund.academicYear;
    }

    // Fallback: try to get from any refund record
    const anyRefund = await RefundFees.findOne({ schoolId });
    return anyRefund?.academicYear || "2025-2026";
  } catch (error) {
    console.error(`Error getting academic year for school ${schoolId}:`, error);
    return "2025-2026";
  }
}

// Map refund type to fee type for ledger lookup
function getFeeTypeFromRefundType(refundType) {
  const feeTypeMap = {
    "Registration Fee": "Registration",
    "Admission Fee": "Admission",
    "Transfer Certificate Fee": "TC",
    "Board Registration Fee": "Board Registration",
    "Board Exam Fee": "Board Exam",
    "School Fees": "School Fees",
  };

  return feeTypeMap[refundType] || refundType;
}

// Calculate the actual refund amount based on status and schema rules
function calculateRefundAmount(refund) {
  if (refund.status === "Refund") {
    return refund.refundAmount || 0;
  } else if (
    refund.status === "Cancelled" ||
    refund.status === "Cheque Return"
  ) {
    return refund.cancelledAmount || 0;
  }
  return 0;
}

// Get the appropriate date based on status
function getEffectiveDate(refund) {
  if (refund.status === "Refund") {
    return refund.refundDate;
  } else if (
    refund.status === "Cancelled" ||
    refund.status === "Cheque Return"
  ) {
    return refund.cancelledDate;
  }
  return refund.createdAt; // fallback
}

async function getTodaysRefunds(schoolId) {
  const today = new Date();
  const startOfToday = normalizeDateToUTCStartOfDay(today);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  console.log(
    `Fetching refunds for school ${schoolId} on date: ${startOfToday}`
  );

  // FIXED: Query based on the actual schema enum values and date fields
  const todaysRefunds = await RefundFees.find({
    schoolId,
    status: { $in: ["Refund", "Cancelled", "Cheque Return"] }, // FIXED: Correct enum values
    isProcessedInFinance: { $ne: true },
    $or: [
      // For "Refund" status records
      {
        status: "Refund",
        refundDate: { $gte: startOfToday, $lt: startOfTomorrow },
        refundAmount: { $gt: 0 },
      },
      // For "Cancelled" status records
      {
        status: "Cancelled",
        cancelledDate: { $gte: startOfToday, $lt: startOfTomorrow },
        cancelledAmount: { $gt: 0 },
      },
      // For "Cheque Return" status records
      {
        status: "Cheque Return",
        cancelledDate: { $gte: startOfToday, $lt: startOfTomorrow },
        cancelledAmount: { $gt: 0 },
      },
    ],
  });

  // Transform data for finance module
  const allRefunds = todaysRefunds.map((refund) => {
    const refundAmount = calculateRefundAmount(refund);
    const effectiveDate = getEffectiveDate(refund);

    return {
      refundId: refund._id.toString(),
      refundAmount: refundAmount,
      finalAmount: -refundAmount, // Negative amount for finance module (refund)
      refundDate: effectiveDate,
      academicYear: refund.academicYear,
      paymentMode: refund.paymentMode,
      feeType: getFeeTypeFromRefundType(refund.refundType),
      refundType: refund.refundType,
      status: refund.status,
      source: "RefundFees",
      originalReceiptNumber: refund.existancereceiptNumber,
      cancelledAmount: refund.cancelledAmount,
      receiptNumber: refund.receiptNumber,
      // Additional fields that might be useful for finance module
      paidAmount: refund.paidAmount,
      balance: refund.balance,
      transactionNumber: refund.transactionNumber,
    };
  });

  console.log(
    `Found ${allRefunds.length} refunds to process for school ${schoolId}`
  );

  // Debug log to see what refunds were found
  if (allRefunds.length > 0) {
    console.log(
      "Refunds found:",
      allRefunds.map((r) => ({
        id: r.refundId,
        amount: r.refundAmount,
        status: r.status,
        type: r.refundType,
        date: r.refundDate,
        originalReceipt: r.originalReceiptNumber,
      }))
    );
  } else {
    console.log("No refunds found with current query. Checking database...");

    // Debug: Check what actually exists in database
    const allUnprocessed = await RefundFees.find({
      schoolId,
      isProcessedInFinance: { $ne: true },
    });

    console.log(
      "All unprocessed refunds in database:",
      allUnprocessed.map((r) => ({
        id: r._id,
        status: r.status,
        refundAmount: r.refundAmount,
        cancelledAmount: r.cancelledAmount,
        refundDate: r.refundDate,
        cancelledDate: r.cancelledDate,
        refundType: r.refundType,
      }))
    );
  }

  return allRefunds;
}

async function markRefundsAsProcessed(refunds) {
  const refundIds = refunds.map((refund) => refund.refundId);

  if (refundIds.length > 0) {
    await RefundFees.updateMany(
      { _id: { $in: refundIds } },
      { $set: { isProcessedInFinance: true } }
    );

    console.log(`Marked ${refundIds.length} refunds as processed`);
  }
}

async function processDailyRefundBatch() {
  try {
    console.log("Starting daily refund batch processing at 10 PM...");

    // Get all school IDs that have unprocessed refunds
    const schoolIds = await getAllSchoolIdsFromRefunds();

    if (schoolIds.length === 0) {
      console.log("No schools with unprocessed refunds found");
      return;
    }

    let totalProcessed = 0;

    for (const schoolId of schoolIds) {
      try {
        // Get academic year for this school
        const financialYear = await getAcademicYearForSchoolFromRefunds(
          schoolId
        );

        const todaysRefunds = await getTodaysRefunds(schoolId);

        if (todaysRefunds.length === 0) {
          console.log(`No refunds to process for school: ${schoolId}`);
          continue;
        }

        // Send to finance module for batch refund processing
        const response = await axios.post(
          `${process.env.FINANCE_MODULE_SERVICE_URL}/api/batch-process-fees-refund`,
          {
            schoolId,
            financialYear,
            processDate: new Date(),
            refundsData: todaysRefunds,
          }
        );

        if (response.data.hasError) {
          console.error(
            `Batch refund processing failed for school ${schoolId}:`,
            response.data.message
          );
          continue;
        }

        // Mark refunds as processed only if finance module processed them successfully
        await markRefundsAsProcessed(todaysRefunds);

        console.log(
          `Successfully processed ${todaysRefunds.length} refunds for school: ${schoolId}`
        );
        totalProcessed += todaysRefunds.length;
      } catch (schoolError) {
        console.error(
          `Error processing refunds for school ${schoolId}:`,
          schoolError
        );
        // Continue with next school even if one fails
      }
    }

    console.log(
      `Daily refund batch processing completed. Total refunds processed: ${totalProcessed}`
    );
  } catch (error) {
    console.error("Error in daily refund batch processing:", error);
  }
}

// Schedule the job to run daily at 10 PM
export function startDailyRefundScheduler() {
  // '0 22 * * *' means at 22:00 (10 PM) every day
  cron.schedule("7 20 * * *", processDailyRefundBatch, {
    scheduled: true,
    timezone: "Asia/Kolkata",
  });

  console.log(
    "Daily batch Refund scheduler started - will run at 10 PM every day"
  );
}
