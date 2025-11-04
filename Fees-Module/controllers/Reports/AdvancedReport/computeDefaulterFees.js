import mongoose from "mongoose";
import FeesStructure from "../../../models/FeesStructure.js";
import FeesType from "../../../models/FeesType.js";
import AdmissionForm from "../../../models/AdmissionForm.js";
import { SchoolFees } from "../../../models/SchoolFees.js";
import ClassAndSection from "../../../models/Class&Section.js";
import { AdmissionPayment } from "../../../models/AdmissionForm.js";
import Refund from "../../../models/RefundFees.js";
import DefaulterFeesArchive from "../../../models/DefaulterFeesArchive.js";
import FeesManagementYear from "../../../models/FeesManagementYear.js";

const validateDate = (dateStr, context = "unknown") => {
  if (!dateStr) {
    console.warn(`Invalid date (null/undefined) in ${context}`);
    return null;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date value "${dateStr}" in ${context}`);
    return null;
  }
  return date;
};

// Enhanced helper function to handle refund allocation properly
const calculateFeeTypeDetails = (
  feeTypeId,
  structureInst,
  payments,
  refunds,
  installmentName,
  feeTypeMap
) => {
  const feeTypeAmount =
    structureInst.fees.find(
      (fee) => fee.feesTypeId.toString() === feeTypeId.toString()
    )?.amount || 0;

  let feesPaid = 0;
  let concession = 0;
  let refundAmount = 0;
  let cancelledAmount = 0;
  let cancelledConcession = 0;

  // Calculate paid amount and concession from payments for this specific fee type
  for (const payment of payments) {
    if (!payment.cancelledDate) {
      for (const feeItem of payment.feeItems) {
        if (feeItem.feeTypeId.toString() === feeTypeId.toString()) {
          feesPaid += feeItem.paid || 0;
          concession += feeItem.concession || 0;
        }
      }
    }
  }

  console.log(
    `Initial calculation for ${
      feeTypeMap[feeTypeId.toString()]
    }: feesPaid=${feesPaid}, concession=${concession}`
  );

  // Calculate refund and cancelled amounts for this fee type
  for (const refund of refunds) {
    console.log(`Processing refund:`, {
      installmentName: refund.installmentName,
      feeTypeRefunds: refund.feeTypeRefunds,
      refundAmount: refund.refundAmount,
      cancelledAmount: refund.cancelledAmount,
      concessionAmount: refund.concessionAmount,
      status: refund.status,
    });

    // Check if this refund matches our installment
    if (refund.installmentName !== installmentName) {
      continue;
    }

    // Check feeTypeRefunds array first - match by feeTypeId
    const feeTypeRefund = refund.feeTypeRefunds?.find(
      (ftr) => ftr.feeType?.toString() === feeTypeId.toString()
    );

    if (feeTypeRefund) {
      console.log(
        `Found feeTypeRefund for ${feeTypeMap[feeTypeId.toString()]}:`,
        feeTypeRefund
      );
      if (["Refund", "Cancelled", "Cheque Return"].includes(refund.status)) {
        refundAmount += feeTypeRefund.refundAmount || 0;
        cancelledAmount += feeTypeRefund.cancelledAmount || 0;
        cancelledConcession += feeTypeRefund.concessionAmount || 0;
      }
    } else if (!refund.feeTypeRefunds || refund.feeTypeRefunds.length === 0) {
      // This is a general refund for the installment without specific fee type allocation
      // Allocate amounts proportionally based on what was paid for each fee type
      console.log(
        `General refund without feeTypeRefunds - allocating proportionally`
      );

      const totalPaidForInstallment = payments.reduce((sum, payment) => {
        if (!payment.cancelledDate) {
          return (
            sum +
            payment.feeItems.reduce(
              (itemSum, item) => itemSum + (item.paid || 0),
              0
            )
          );
        }
        return sum;
      }, 0);

      const totalConcessionForInstallment = payments.reduce((sum, payment) => {
        if (!payment.cancelledDate) {
          return (
            sum +
            payment.feeItems.reduce(
              (itemSum, item) => itemSum + (item.concession || 0),
              0
            )
          );
        }
        return sum;
      }, 0);

      console.log(
        `Total paid for installment: ${totalPaidForInstallment}, Total concession: ${totalConcessionForInstallment}`
      );

      if (totalPaidForInstallment > 0) {
        const feeTypePaid = payments.reduce((sum, payment) => {
          if (!payment.cancelledDate) {
            return (
              sum +
              payment.feeItems.reduce((itemSum, item) => {
                if (item.feeTypeId.toString() === feeTypeId.toString()) {
                  return itemSum + (item.paid || 0);
                }
                return itemSum;
              }, 0)
            );
          }
          return sum;
        }, 0);

        const feeTypeRatio = feeTypePaid / totalPaidForInstallment;
        console.log(
          `FeeType ${
            feeTypeMap[feeTypeId.toString()]
          } paid: ${feeTypePaid}, ratio: ${feeTypeRatio}`
        );

        if (["Refund", "Cancelled", "Cheque Return"].includes(refund.status)) {
          const allocatedRefundAmount =
            (refund.refundAmount || 0) * feeTypeRatio;
          const allocatedCancelledAmount =
            (refund.cancelledAmount || 0) * feeTypeRatio;

          refundAmount += allocatedRefundAmount;
          cancelledAmount += allocatedCancelledAmount;

          console.log(
            `Allocated to ${
              feeTypeMap[feeTypeId.toString()]
            }: refundAmount=${allocatedRefundAmount}, cancelledAmount=${allocatedCancelledAmount}`
          );
        }
      }

      if (totalConcessionForInstallment > 0) {
        const feeTypeConcession = payments.reduce((sum, payment) => {
          if (!payment.cancelledDate) {
            return (
              sum +
              payment.feeItems.reduce((itemSum, item) => {
                if (item.feeTypeId.toString() === feeTypeId.toString()) {
                  return itemSum + (item.concession || 0);
                }
                return itemSum;
              }, 0)
            );
          }
          return sum;
        }, 0);

        const concessionRatio =
          feeTypeConcession / totalConcessionForInstallment;
        console.log(
          `FeeType ${
            feeTypeMap[feeTypeId.toString()]
          } concession: ${feeTypeConcession}, ratio: ${concessionRatio}`
        );

        if (["Refund", "Cancelled", "Cheque Return"].includes(refund.status)) {
          const allocatedCancelledConcession =
            (refund.concessionAmount || 0) * concessionRatio;
          cancelledConcession += allocatedCancelledConcession;
          console.log(
            `Allocated cancelled concession: ${allocatedCancelledConcession}`
          );
        }
      }
    }
  }

  console.log(
    `Final for ${
      feeTypeMap[feeTypeId.toString()]
    }: refundAmount=${refundAmount}, cancelledAmount=${cancelledAmount}, cancelledConcession=${cancelledConcession}`
  );

  // Adjust paid amount for refunds and cancellations
  const adjustedFeesPaid = Math.max(
    0,
    feesPaid - refundAmount - cancelledAmount
  );
  // Adjust concession for cancelled concession
  const adjustedConcession = Math.max(0, concession - cancelledConcession);

  const balance = feeTypeAmount - adjustedConcession - adjustedFeesPaid;

  return {
    feeTypeId: feeTypeId.toString(),
    feeTypeName: feeTypeMap[feeTypeId.toString()] || "Unknown",
    feesDue: feeTypeAmount,
    concession: adjustedConcession,
    feesPaid: adjustedFeesPaid,
    refundAmount,
    cancelledAmount,
    cancelledConcession,
    balance,
  };
};

async function computeDefaulterFees(
  schoolId,
  academicYear,
  session,
  classes,
  sections,
  installment
) {
  const today = new Date();

  const feesManagementYear = await FeesManagementYear.findOne({
    schoolId,
    academicYear,
  })
    .lean()
    .session(session);

  let isAcademicYearEnded = false;
  if (feesManagementYear && feesManagementYear.endDate) {
    const endDate = validateDate(
      feesManagementYear.endDate,
      `FeesManagementYear endDate for ${academicYear}`
    );
    if (endDate && today > endDate) {
      isAcademicYearEnded = true;
    }
  }

  const archivedDefaulters = await DefaulterFeesArchive.findOne({
    schoolId,
    academicYear,
  })
    .lean()
    .session(session);

  if (isAcademicYearEnded) {
    if (!archivedDefaulters || !archivedDefaulters.defaulters) {
      return {
        hasError: false,
        message:
          "No archived defaulter data found for the ended academic year.",
        data: [],
        feeTypes: [],
        filterOptions: {},
      };
    }

    const filteredArchivedData = archivedDefaulters.defaulters
      .filter(
        (defaulter) =>
          defaulter.tcStatus === "Active" &&
          (!classes || classes.split(",").includes(defaulter.className)) &&
          (!sections || sections.split(",").includes(defaulter.sectionName)) &&
          (!installment ||
            defaulter.installments.some(
              (inst) => inst.installmentName === installment
            ))
      )
      .map((defaulter) => ({
        ...defaulter,
        lockDate: archivedDefaulters.storedAt
          ? new Date(archivedDefaulters.storedAt).toLocaleDateString("en-GB")
          : null,
      }));

    // Extract fee types from archived data
    const allFeeTypes = Array.from(
      new Set(
        filteredArchivedData.flatMap((defaulter) =>
          defaulter.installments.flatMap((installment) =>
            Object.keys(installment.feeTypes || {})
          )
        )
      )
    ).sort();

    const classOptions = Array.from(
      new Set(filteredArchivedData.map((d) => d.className))
    ).map((name) => ({
      value: name,
      label: name,
    }));
    const sectionOptions = Array.from(
      new Set(filteredArchivedData.map((d) => d.sectionName))
    ).map((name) => ({
      value: name,
      label: name,
    }));
    const installmentOptions = Array.from(
      new Set(
        filteredArchivedData.flatMap((d) =>
          d.installments.map((inst) => inst.installmentName)
        )
      )
    ).map((inst) => ({ value: inst, label: inst }));
    const paymentModeOptions = Array.from(
      new Set(
        filteredArchivedData.flatMap((d) =>
          d.installments.map((inst) => inst.paymentMode)
        )
      )
    )
      .filter(Boolean)
      .map((mode) => ({ value: mode, label: mode }));
    const tcStatusOptions = [
      { value: "Active", label: "Active" },
      { value: "Inactive", label: "Inactive" },
    ];

    return {
      hasError: false,
      message:
        "Archived defaulter data fetched successfully for ended academic year.",
      data: filteredArchivedData,
      feeTypes: allFeeTypes,
      filterOptions: {
        classOptions,
        sectionOptions,
        installmentOptions,
        paymentModeOptions,
        tcStatusOptions,
      },
    };
  }

  const students = await AdmissionForm.find({ schoolId })
    .select(
      "AdmissionNumber firstName lastName parentContactNumber academicHistory TCStatus _id"
    )
    .lean()
    .session(session);

  if (!students.length && !archivedDefaulters) {
    return {
      hasError: false,
      message: "No students or archived defaulters found.",
      data: [],
      feeTypes: [],
      filterOptions: {},
    };
  }

  const lateAdmissionThreshold = new Date(today);
  lateAdmissionThreshold.setMonth(today.getMonth() - 3);

  const classAndSections = await ClassAndSection.find({
    schoolId,
    academicYear,
  })
    .lean()
    .session(session);
  const classMap = classAndSections.reduce((acc, item) => {
    acc[item._id.toString()] = item.className;
    return acc;
  }, {});
  const sectionMap = classAndSections.reduce((acc, item) => {
    item.sections.forEach((section) => {
      acc[section._id.toString()] = section.name;
    });
    return acc;
  }, {});

  const filteredClassIds = classes
    ? Object.keys(classMap).filter((id) =>
        classes.split(",").includes(classMap[id])
      )
    : Object.keys(classMap);
  const filteredSectionIds = sections
    ? Object.keys(sectionMap).filter((id) =>
        sections.split(",").includes(sectionMap[id])
      )
    : Object.keys(sectionMap);

  // Fetch fee types
  const feeTypes = await FeesType.find({ academicYear })
    .lean()
    .session(session);
  const feeTypeMap = feeTypes.reduce((acc, type) => {
    acc[type._id.toString()] = type.feesTypeName || "Unknown";
    return acc;
  }, {});
  const allFeeTypes = feeTypes
    .map((type) => type.feesTypeName)
    .filter(Boolean)
    .sort();

  const resultMap = new Map();

  for (const student of students) {
    const admissionNumber = student.AdmissionNumber;
    const parentContactNumber = student.parentContactNumber || "-";
    const academicHistory = student.academicHistory.find(
      (history) => history.academicYear === academicYear
    );
    const tcStatus = student.TCStatus || "Active";

    if (tcStatus === "Inactive") {
      console.log(`Skipping inactive student: ${admissionNumber}`);
      continue;
    }

    if (!academicHistory) {
      console.log(
        `No academic history for student ${admissionNumber} in ${academicYear}`
      );
      continue;
    }

    const { masterDefineClass, section } = academicHistory;

    if (
      !filteredClassIds.includes(masterDefineClass.toString()) ||
      !filteredSectionIds.includes(section.toString())
    ) {
      continue;
    }

    const feesStructures = await FeesStructure.find({
      schoolId,
      classId: masterDefineClass,
      sectionIds: { $in: [section] },
      academicYear,
    })
      .lean()
      .session(session);

    if (!feesStructures.length) {
      console.log(
        `No fees structures for student ${admissionNumber}, class ${masterDefineClass}, section ${section}`
      );
      continue;
    }

    const allPaidFeesData = await SchoolFees.find({
      schoolId,
      studentAdmissionNumber: admissionNumber,
      academicYear,
    })
      .lean()
      .session(session);

    const firstAdmissionPayment = await AdmissionPayment.findOne({
      studentId: student._id,
      schoolId,
      academicYear,
      status: "Paid",
    })
      .sort({ paymentDate: 1 })
      .lean()
      .session(session);

    const isLateAdmission =
      firstAdmissionPayment &&
      validateDate(
        firstAdmissionPayment.paymentDate,
        `AdmissionPayment for ${admissionNumber}`
      ) >= lateAdmissionThreshold;

    // Fetch refunds with proper matching
    const refunds = await Refund.find({
      schoolId,
      admissionNumber,
      academicYear,
      refundType: "School Fees",
      status: { $in: ["Refund", "Cancelled", "Cheque Return"] },
    })
      .lean()
      .session(session);

    console.log(`=== REFUNDS FOR ${admissionNumber} ===`);
    console.log(JSON.stringify(refunds, null, 2));
    console.log(`=== END REFUNDS ===`);

    const paymentsByInstallment = allPaidFeesData
      .flatMap((payment) => {
        const paymentDate = validateDate(
          payment.paymentDate,
          `SchoolFees paymentDate for ${admissionNumber}`
        );
        return payment.installments.map((inst) => ({
          ...inst,
          paymentDate,
          paymentMode: payment.paymentMode || "-",
          reportStatus: payment.reportStatus || [],
          receiptNumber: payment.receiptNumber,
          cancelledDate: validateDate(
            payment.cancelledDate,
            `SchoolFees cancelledDate for ${admissionNumber}`
          ),
        }));
      })
      .reduce((acc, inst) => {
        const instName = inst.installmentName;
        if (!acc[instName]) {
          acc[instName] = [];
        }
        acc[instName].push(inst);
        return acc;
      }, {});

    const allInstallments = feesStructures.flatMap(
      (structure) => structure.installments
    );
    const sortedInstallments = [
      ...new Set(allInstallments.map((inst) => inst.name)),
    ].sort((a, b) => {
      const dueDateA = allInstallments.find((inst) => inst.name === a)?.dueDate;
      const dueDateB = allInstallments.find((inst) => inst.name === b)?.dueDate;
      const dateA = validateDate(dueDateA, `Installment ${a} dueDate`);
      const dateB = validateDate(dueDateB, `Installment ${b} dueDate`);
      return dateA && dateB ? dateA - dateB : 0;
    });

    const filteredInstallmentNames = installment
      ? [installment]
      : sortedInstallments;

    let defaulterType = [];
    let allStudentInstallments = [];

    let hasUnpaidPastDueInstallment = false;
    const defaulterInstallments = [];

    for (const instName of filteredInstallmentNames) {
      const structureInst = allInstallments.find(
        (inst) => inst.name === instName
      );
      if (!structureInst || !structureInst.dueDate) {
        console.log(`No valid due date for installment ${instName}`);
        continue;
      }

      const dueDate = validateDate(
        structureInst.dueDate,
        `FeesStructure dueDate for ${instName}`
      );
      if (!dueDate) {
        console.warn(`Skipping installment ${instName} due to invalid dueDate`);
        continue;
      }

      if (today <= dueDate) {
        console.log(
          `Installment ${instName} is not past due (due: ${dueDate.toISOString()})`
        );
        continue;
      }

      const daysOverdue =
        Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)) - 1;

      let initialFeesDue = 0;
      for (const fee of structureInst.fees) {
        initialFeesDue += fee.amount || 0;
      }

      // Get relevant refunds for this specific installment
      const relevantRefunds = refunds.filter(
        (refund) => refund.installmentName === instName
      );

      console.log(
        `Relevant refunds for ${admissionNumber} - ${instName}:`,
        relevantRefunds.length
      );

      // Calculate detailed fee type breakdown
      const feeTypeDetails = {};
      let totalAdjustedFeesPaid = 0;
      let totalFeeTypeConcession = 0;
      let totalFeeTypeRefund = 0;
      let totalFeeTypeCancelled = 0;
      let totalFeeTypeCancelledConcession = 0;

      const payments = paymentsByInstallment[instName] || [];

      for (const fee of structureInst.fees) {
        const feeTypeId = fee.feesTypeId;
        const details = calculateFeeTypeDetails(
          feeTypeId,
          structureInst,
          payments,
          relevantRefunds,
          instName,
          feeTypeMap
        );

        feeTypeDetails[details.feeTypeName] = details;
        totalAdjustedFeesPaid += details.feesPaid;
        totalFeeTypeConcession += details.concession;
        totalFeeTypeRefund += details.refundAmount;
        totalFeeTypeCancelled += details.cancelledAmount;
        totalFeeTypeCancelledConcession += details.cancelledConcession;
      }

      // Check if this installment has unpaid amount
      const adjustedNetFeesDue = initialFeesDue - totalFeeTypeConcession;
      const adjustedBalance = adjustedNetFeesDue - totalAdjustedFeesPaid;

      if (totalAdjustedFeesPaid < adjustedNetFeesDue) {
        hasUnpaidPastDueInstallment = true;

        defaulterInstallments.push({
          paymentDate:
            payments.length && payments[0].paymentDate
              ? new Date(payments[0].paymentDate).toLocaleDateString("en-GB")
              : "-",
          cancelledDate: null,
          reportStatus: payments.length ? payments[0].reportStatus : [],
          paymentMode: payments.length ? payments[0].paymentMode : "-",
          installmentName: instName,
          dueDate: dueDate ? dueDate.toLocaleDateString("en-GB") : null,
          feesDue: initialFeesDue,
          netFeesDue: adjustedNetFeesDue,
          feesPaid: totalAdjustedFeesPaid,
          concession: totalFeeTypeConcession,
          balance: adjustedBalance,
          daysOverdue,
          feeTypes: feeTypeDetails,
          feeTypeBreakdown: Object.values(feeTypeDetails),
          totals: {
            totalRefundAmount: totalFeeTypeRefund,
            totalCancelledAmount: totalFeeTypeCancelled,
            totalCancelledConcession: totalFeeTypeCancelledConcession,
          },
        });
      }
    }

    if (hasUnpaidPastDueInstallment) {
      defaulterType.push("Defaulter");
      allStudentInstallments.push(...defaulterInstallments);
    }

    // Late admission logic (simplified for this example)
    if (isLateAdmission) {
      // Add late admission logic here if needed
    }

    if (allStudentInstallments.length > 0) {
      const uniqueInstallments = [];
      const seenInstallments = new Set();

      for (const inst of allStudentInstallments) {
        const key = `${inst.installmentName}-${inst.feesPaid}-${inst.paymentDate}`;
        if (!seenInstallments.has(key)) {
          seenInstallments.add(key);
          uniqueInstallments.push(inst);
        }
      }

      if (uniqueInstallments.length > 0) {
        for (const inst of uniqueInstallments) {
          const key = `${admissionNumber}-${inst.installmentName}`;

          resultMap.set(key, {
            admissionNumber,
            studentName: `${student.firstName} ${student.lastName || ""}`,
            className: classMap[masterDefineClass] || masterDefineClass,
            sectionName: sectionMap[section] || section,
            academicYear,
            parentContactNumber,
            tcStatus,
            admissionPaymentDate:
              firstAdmissionPayment && firstAdmissionPayment.paymentDate
                ? validateDate(
                    firstAdmissionPayment.paymentDate,
                    `AdmissionPayment for ${admissionNumber}`
                  )?.toLocaleDateString("en-GB") || null
                : null,
            defaulterType: defaulterType.join(", ") || "Defaulter",
            installments: [inst],
            totals: {
              totalFeesDue: inst.feesDue,
              totalNetFeesDue: inst.netFeesDue,
              totalFeesPaid: inst.feesPaid,
              totalConcession: inst.concession,
              totalBalance: inst.balance,
              totalCancelledAmount: inst.totals.totalCancelledAmount,
              totalCancelledConcession: inst.totals.totalCancelledConcession,
            },
          });
        }
      }
    }
  }

  // Handle archived defaulters if any
  if (archivedDefaulters && archivedDefaulters.defaulters) {
    for (const defaulter of archivedDefaulters.defaulters) {
      if (
        (classes && !classes.split(",").includes(defaulter.className)) ||
        (sections && !sections.split(",").includes(defaulter.sectionName)) ||
        (installment &&
          !defaulter.installments.some(
            (inst) => inst.installmentName === installment
          ))
      ) {
        continue;
      }

      const key = `${defaulter.admissionNumber}-${
        defaulter.installments[0]?.installmentName || "archive"
      }`;
      resultMap.set(key, {
        ...defaulter,
        lockDate: archivedDefaulters.storedAt
          ? new Date(archivedDefaulters.storedAt).toLocaleDateString("en-GB")
          : null,
      });
    }
  }

  // Generate filter options
  const classOptions = Array.from(
    new Set([
      ...Object.values(classMap),
      ...resultMap.values().map((d) => d.className),
    ])
  ).map((name) => ({
    value: name,
    label: name,
  }));
  const sectionOptions = Array.from(
    new Set([
      ...Object.values(sectionMap),
      ...resultMap.values().map((d) => d.sectionName),
    ])
  ).map((name) => ({
    value: name,
    label: name,
  }));
  const installmentOptions = Array.from(
    new Set(
      Array.from(resultMap.values()).flatMap((item) =>
        item.installments.map((inst) => inst.installmentName)
      )
    )
  ).map((inst) => ({ value: inst, label: inst }));
  const paymentModeOptions = Array.from(
    new Set(
      (
        await SchoolFees.find({ schoolId, academicYear })
          .lean()
          .session(session)
      )
        .map((fee) => fee.paymentMode)
        .concat(
          resultMap
            .values()
            .flatMap((d) => d.installments.map((inst) => inst.paymentMode))
        )
    )
  )
    .filter(Boolean)
    .map((mode) => ({ value: mode, label: mode }));
  const tcStatusOptions = [
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
  ];

  return {
    hasError: false,
    message: "Defaulter data fetched successfully.",
    data: Array.from(resultMap.values()),
    feeTypes: allFeeTypes,
    filterOptions: {
      classOptions,
      sectionOptions,
      installmentOptions,
      paymentModeOptions,
      tcStatusOptions,
    },
  };
}

export default computeDefaulterFees;
