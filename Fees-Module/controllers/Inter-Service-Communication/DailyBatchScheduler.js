// Fees-Module/controllers/Inter-Service-Communication/DailyBatchScheduler.js
import cron from "node-cron";
import axios from "axios";
import mongoose from "mongoose";
import { TCPayment } from "../../models/TCForm.js";
import { AdmissionPayment } from "../../models/AdmissionForm.js";
import { RegistrationPayment } from "../../models/RegistrationForm.js";
import BoardRegistrationPayment from "../../models/BoardRegistrationFeePayment.js";
import BoardExamFeePayment from "../../models/BoardExamFeePayment.js";
import { SchoolFees } from "../../models/SchoolFees.js";
import FeesType from "../../models/FeesType.js";

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

// Get all unique school IDs from payment tables
async function getAllSchoolIds() {
  try {
    // Get distinct school IDs from all payment tables
    const [
      tcSchoolIds,
      admissionSchoolIds,
      registrationSchoolIds,
      boardRegistrationSchoolIds,
      boardExamFeeSchoolIds,
      schoolFeesSchoolIds,
    ] = await Promise.all([
      TCPayment.distinct("schoolId", {
        paymentMode: { $ne: "null" },
        status: "Paid",
        isProcessedInFinance: { $ne: true },
      }),
      AdmissionPayment.distinct("schoolId", {
        paymentMode: { $ne: "null" },
        status: "Paid",
        isProcessedInFinance: { $ne: true },
      }),
      RegistrationPayment.distinct("schoolId", {
        paymentMode: { $ne: "null" },
        status: "Paid",
        isProcessedInFinance: { $ne: true },
      }),
      BoardRegistrationPayment.distinct("schoolId", {
        paymentMode: { $ne: "null" },
        status: "Paid",
        isProcessedInFinance: { $ne: true },
      }),
      BoardExamFeePayment.distinct("schoolId", {
        paymentMode: { $ne: "null" },
        status: "Paid",
        isProcessedInFinance: { $ne: true },
      }),
      SchoolFees.distinct("schoolId", {
        paymentMode: { $ne: "null" },
        status: "Paid",
        isProcessedInFinance: { $ne: true },
      }),
    ]);

    // Combine and get unique school IDs
    const allSchoolIds = [
      ...new Set([
        ...tcSchoolIds,
        ...admissionSchoolIds,
        ...registrationSchoolIds,
        ...boardRegistrationSchoolIds,
        ...boardExamFeeSchoolIds,
        ...schoolFeesSchoolIds,
      ]),
    ];

    console.log(
      `Found ${allSchoolIds.length} schools with unprocessed payments`
    );
    return allSchoolIds;
  } catch (error) {
    console.error("Error getting school IDs:", error);
    return [];
  }
}

// Get academic year for a school (get from any payment record)
async function getAcademicYearForSchool(schoolId) {
  try {
    // Try to get academic year from any payment table
    const payment =
      (await RegistrationPayment.findOne({ schoolId })) ||
      (await AdmissionPayment.findOne({ schoolId })) ||
      (await TCPayment.findOne({ schoolId })) ||
      (await BoardRegistrationPayment.findOne({ schoolId })) ||
      (await BoardExamFeePayment.findOne({ schoolId })) ||
      (await SchoolFees.findOne({ schoolId }));

    return payment.academicYear;
  } catch (error) {
    console.error(`Error getting academic year for school ${schoolId}:`, error);
    return "2025-2026"; // Default fallback
  }
}

// Function to get fees type name from feeTypeId
async function getFeesTypeName(feeTypeId) {
  try {
    const feesType = await FeesType.findById(feeTypeId);
    return feesType?.feesTypeName || "School Fees"; // Default fallback
  } catch (error) {
    console.error(`Error getting fees type name for ID ${feeTypeId}:`, error);
    return "School Fees"; // Default fallback
  }
}

async function getTodaysPayments(schoolId) {
  const today = new Date();
  const startOfToday = normalizeDateToUTCStartOfDay(today);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  console.log(
    `Fetching payments for school ${schoolId} on date: ${startOfToday}`
  );

  // Fetch payments from all tables for today
  const [
    tcPayments,
    admissionPayments,
    registrationPayments,
    boardRegistrationPayments,
    boardExamFeePayments,
    schoolFeesPayments,
  ] = await Promise.all([
    TCPayment.find({
      schoolId,
      paymentDate: {
        $gte: startOfToday,
        $lt: startOfTomorrow,
      },
      paymentMode: { $ne: "null" },
      status: "Paid",
      isProcessedInFinance: { $ne: true },
    }),
    AdmissionPayment.find({
      schoolId,
      paymentDate: {
        $gte: startOfToday,
        $lt: startOfTomorrow,
      },
      paymentMode: { $ne: "null" },
      status: "Paid",
      isProcessedInFinance: { $ne: true },
    }),
    RegistrationPayment.find({
      schoolId,
      paymentDate: {
        $gte: startOfToday,
        $lt: startOfTomorrow,
      },
      paymentMode: { $ne: "null" },
      status: "Paid",
      isProcessedInFinance: { $ne: true },
    }),
    BoardRegistrationPayment.find({
      schoolId,
      paymentDate: {
        $gte: startOfToday,
        $lt: startOfTomorrow,
      },
      paymentMode: { $ne: "null" },
      status: "Paid",
      isProcessedInFinance: { $ne: true },
    }),
    BoardExamFeePayment.find({
      schoolId,
      paymentDate: {
        $gte: startOfToday,
        $lt: startOfTomorrow,
      },
      paymentMode: { $ne: "null" },
      status: "Paid",
      isProcessedInFinance: { $ne: true },
    }),
    SchoolFees.find({
      schoolId,
      paymentDate: {
        $gte: startOfToday,
        $lt: startOfTomorrow,
      },
      paymentMode: { $ne: "null" },
      status: "Paid",
      isProcessedInFinance: { $ne: true },
    }),
  ]);

  // Process SchoolFees payments - flatten installments and fee items
  const schoolFeesFlattened = [];

  for (const schoolFee of schoolFeesPayments) {
    console.log(
      `Processing SchoolFee: ${schoolFee._id}, excessAmount: ${schoolFee.installments[0]?.excessAmount}, fineAmount: ${schoolFee.installments[0]?.fineAmount}`
    );

    for (const installment of schoolFee.installments) {
      console.log(
        `Installment: ${installment.installmentName}, excess: ${installment.excessAmount}, fine: ${installment.fineAmount}`
      );

      // Process fee items
      for (const feeItem of installment.feeItems) {
        if (feeItem.paid > 0) {
          const feesTypeName = await getFeesTypeName(feeItem.feeTypeId);
          schoolFeesFlattened.push({
            paymentId: schoolFee._id.toString(),
            finalAmount: feeItem.paid,
            paymentDate: schoolFee.paymentDate,
            academicYear: schoolFee.academicYear,
            paymentMode: schoolFee.paymentMode,
            feeType: feesTypeName,
            source: "SchoolFees",
            installmentName: installment.installmentName,
            feeItemId: feeItem._id.toString(),
            type: "feeItem",
            concessionAmount: feeItem.concession || 0,
          });
        }
      }

      // Process excess amount if exists
      if (installment.excessAmount > 0) {
        console.log(`Adding excess payment: ${installment.excessAmount}`);
        schoolFeesFlattened.push({
          paymentId: schoolFee._id.toString(),
          finalAmount: installment.excessAmount,
          paymentDate: schoolFee.paymentDate,
          academicYear: schoolFee.academicYear,
          paymentMode: schoolFee.paymentMode,
          feeType: "Excess",
          source: "SchoolFees",
          installmentName: installment.installmentName,
          type: "excess",
        });
      }

      // Process fine amount if exists
      if (installment.fineAmount > 0) {
        console.log(`Adding fine payment: ${installment.fineAmount}`);
        schoolFeesFlattened.push({
          paymentId: schoolFee._id.toString(),
          finalAmount: installment.fineAmount,
          paymentDate: schoolFee.paymentDate,
          academicYear: schoolFee.academicYear,
          paymentMode: schoolFee.paymentMode,
          feeType: "Fine",
          source: "SchoolFees",
          installmentName: installment.installmentName,
          type: "fine",
        });
      }
    }
  }

  // Transform data for finance module
  const allPayments = [
    ...tcPayments.map((payment) => ({
      paymentId: payment._id.toString(),
      finalAmount: payment.finalAmount,
      paymentDate: payment.paymentDate,
      academicYear: payment.academicYear,
      paymentMode: payment.paymentMode,
      feeType: "TC",
      source: "TCPayment",
    })),
    ...admissionPayments.map((payment) => ({
      paymentId: payment._id.toString(),
      finalAmount: payment.finalAmount,
      paymentDate: payment.paymentDate,
      academicYear: payment.academicYear,
      paymentMode: payment.paymentMode,
      feeType: "Admission",
      source: "AdmissionPayment",
    })),
    ...registrationPayments.map((payment) => ({
      paymentId: payment._id.toString(),
      finalAmount: payment.finalAmount,
      paymentDate: payment.paymentDate,
      academicYear: payment.academicYear,
      paymentMode: payment.paymentMode,
      feeType: "Registration",
      source: "RegistrationPayment",
    })),
    ...boardRegistrationPayments.map((payment) => ({
      paymentId: payment._id.toString(),
      finalAmount: payment.finalAmount,
      paymentDate: payment.paymentDate,
      academicYear: payment.academicYear,
      paymentMode: payment.paymentMode,
      feeType: "Board Registration",
      source: "BoardRegistrationPayment",
    })),
    ...boardExamFeePayments.map((payment) => ({
      paymentId: payment._id.toString(),
      finalAmount: payment.finalAmount,
      paymentDate: payment.paymentDate,
      academicYear: payment.academicYear,
      paymentMode: payment.paymentMode,
      feeType: "Board Exam",
      source: "BoardExamFeePayment",
    })),
    ...schoolFeesFlattened,
  ];

  const excessPayments = allPayments.filter((p) => p.feeType === "Excess");
  const finePayments = allPayments.filter((p) => p.feeType === "Fine");

  console.log("Excess payments found:", excessPayments.length);
  console.log("Fine payments found:", finePayments.length);
  console.log("All payments count:", allPayments.length);

  console.log(
    `Found ${allPayments.length} payments to process for school ${schoolId}`
  );

  // Debug: Log how many payments from each source
  console.log("Payment breakdown:", {
    tcPayments: tcPayments.length,
    admissionPayments: admissionPayments.length,
    registrationPayments: registrationPayments.length,
    boardRegistrationPayments: boardRegistrationPayments.length,
    boardExamFeePayments: boardExamFeePayments.length,
    schoolFeesPayments: schoolFeesPayments.length,
    schoolFeesFlattened: schoolFeesFlattened.length,
    totalAllPayments: allPayments.length,
  });

  const schoolFeesFeeItems = schoolFeesFlattened.filter(
    (p) => p.type === "feeItem"
  ).length;
  const schoolFeesExcess = schoolFeesFlattened.filter(
    (p) => p.type === "excess"
  ).length;
  const schoolFeesFine = schoolFeesFlattened.filter(
    (p) => p.type === "fine"
  ).length;

  console.log("SchoolFees detailed breakdown:", {
    feeItems: schoolFeesFeeItems,
    excessPayments: schoolFeesExcess,
    finePayments: schoolFeesFine,
  });

  return allPayments;
}

async function markPaymentsAsProcessed(payments) {
  const tcPaymentIds = payments
    .filter((p) => p.source === "TCPayment")
    .map((p) => p.paymentId);

  const admissionPaymentIds = payments
    .filter((p) => p.source === "AdmissionPayment")
    .map((p) => p.paymentId);

  const registrationPaymentIds = payments
    .filter((p) => p.source === "RegistrationPayment")
    .map((p) => p.paymentId);

  const boardRegistrationPaymentIds = payments
    .filter((p) => p.source === "BoardRegistrationPayment")
    .map((p) => p.paymentId);

  const boardExamFeePaymentIds = payments
    .filter((p) => p.source === "BoardExamFeePayment")
    .map((p) => p.paymentId);

  const schoolFeesPaymentIds = payments
    .filter((p) => p.source === "SchoolFees")
    .map((p) => p.paymentId);

  await Promise.all([
    tcPaymentIds.length > 0
      ? TCPayment.updateMany(
          { _id: { $in: tcPaymentIds } },
          { $set: { isProcessedInFinance: true } }
        )
      : Promise.resolve(),

    admissionPaymentIds.length > 0
      ? AdmissionPayment.updateMany(
          { _id: { $in: admissionPaymentIds } },
          { $set: { isProcessedInFinance: true } }
        )
      : Promise.resolve(),

    registrationPaymentIds.length > 0
      ? RegistrationPayment.updateMany(
          { _id: { $in: registrationPaymentIds } },
          { $set: { isProcessedInFinance: true } }
        )
      : Promise.resolve(),

    boardRegistrationPaymentIds.length > 0
      ? BoardRegistrationPayment.updateMany(
          { _id: { $in: boardRegistrationPaymentIds } },
          { $set: { isProcessedInFinance: true } }
        )
      : Promise.resolve(),

    boardExamFeePaymentIds.length > 0
      ? BoardExamFeePayment.updateMany(
          { _id: { $in: boardExamFeePaymentIds } },
          { $set: { isProcessedInFinance: true } }
        )
      : Promise.resolve(),

    schoolFeesPaymentIds.length > 0
      ? SchoolFees.updateMany(
          { _id: { $in: schoolFeesPaymentIds } },
          { $set: { isProcessedInFinance: true } }
        )
      : Promise.resolve(),
  ]);
}

async function processDailyBatch() {
  try {
    console.log("Starting daily batch processing at 10 PM...");

    // Get all school IDs that have unprocessed payments
    const schoolIds = await getAllSchoolIds();

    if (schoolIds.length === 0) {
      console.log("No schools with unprocessed payments found");
      return;
    }

    let totalProcessed = 0;

    for (const schoolId of schoolIds) {
      try {
        // Get academic year for this school
        const financialYear = await getAcademicYearForSchool(schoolId);

        const todaysPayments = await getTodaysPayments(schoolId);

        if (todaysPayments.length === 0) {
          console.log(`No payments to process for school: ${schoolId}`);
          continue;
        }

        // Send to finance module for batch processing
        const response = await axios.post(
          `${process.env.FINANCE_MODULE_SERVICE_URL}/api/batch-process-fees-payments`,
          {
            schoolId,
            financialYear,
            processDate: new Date(),
            paymentsData: todaysPayments,
          }
        );

        if (response.data.hasError) {
          console.error(
            `Batch processing failed for school ${schoolId}:`,
            response.data.message
          );
          continue;
        }

        // Mark payments as processed only if finance module processed them successfully
        await markPaymentsAsProcessed(todaysPayments);

        console.log(
          `Successfully processed ${todaysPayments.length} payments for school: ${schoolId}`
        );

        totalProcessed += todaysPayments.length;
      } catch (schoolError) {
        console.error(`Error processing school ${schoolId}:`, schoolError);
        // Continue with next school even if one fails
      }
    }

    console.log(
      `Daily batch processing completed. Total payments processed: ${totalProcessed}`
    );
  } catch (error) {
    console.error("Error in daily batch processing:", error);
  }
}

// Schedule the job to run daily at 10 PM
export function startDailyScheduler() {
  // '0 22 * * *' means at 22:00 (10 PM) every day
  cron.schedule("0 22 * * *", processDailyBatch, {
    scheduled: true,
    timezone: "Asia/Kolkata",
  });

  console.log("Daily batch scheduler started - will run at 10 PM every day");
}
