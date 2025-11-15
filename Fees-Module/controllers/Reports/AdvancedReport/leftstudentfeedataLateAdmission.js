import mongoose from "mongoose";
import FeesStructure from "../../../models/FeesStructure.js";
import FeesType from "../../../models/FeesType.js";
import AdmissionForm from "../../../models/AdmissionForm.js";
import { SchoolFees } from "../../../models/SchoolFees.js";
import ClassAndSection from "../../../models/Class&Section.js";
import { AdmissionPayment } from "../../../models/AdmissionForm.js";
import Refund from "../../../models/RefundFees.js";

export const LateAdmissionUnpaidEarlierInstallments = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { schoolId, academicYear, classes, sections, installment } = req.query;


    if (!schoolId || !academicYear) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "schoolId and academicYear are required",
      });
    }

    const today = new Date();


    const students = await AdmissionForm.find({ schoolId, academicYear })
      .lean()
      .session(session);

    if (!students.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "No students found for the school" });
    }


    const classAndSections = await ClassAndSection.find({ schoolId, academicYear })
      .lean()
      .session(session);

    const classMap = classAndSections.reduce((acc, item) => {
      acc[item._id.toString()] = item.className;
      return acc;
    }, {});

    const sectionMap = {};
    classAndSections.forEach((item) => {
      item.sections.forEach((section) => {
        sectionMap[section._id.toString()] = section.name;
      });
    });


    const filteredClassIds = classes
      ? Object.keys(classMap).filter((id) => classes.split(',').includes(classMap[id]))
      : Object.keys(classMap);

    const filteredSectionIds = sections
      ? Object.keys(sectionMap).filter((id) => sections.split(',').includes(sectionMap[id]))
      : Object.keys(sectionMap);


    const feeTypes = await FeesType.find({ schoolId, academicYear })
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

    const result = [];


    for (const student of students) {
      const admissionNumber = student.AdmissionNumber;
      const academicHistory = student.academicHistory?.find(
        (h) => h.academicYear === academicYear
      );

      if (!academicHistory) continue;

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

      if (!feesStructures.length) continue;

 
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
        status: 'Paid',
      })
        .sort({ paymentDate: 1 })
        .lean()
        .session(session);


      const refunds = await Refund.find({
        schoolId,
        admissionNumber,
        academicYear,
        refundType: 'School Fees',
        status: { $in: ['Refund', 'Cancelled', 'Cheque Return'] },
      })
        .lean()
        .session(session);


      const paymentsByInstallment = allPaidFeesData
        .flatMap((payment) =>
          payment.installments.map((inst) => ({
            ...inst,
            paymentDate: payment.paymentDate,
            paymentMode: payment.paymentMode || "-",
            receiptNumber: payment.receiptNumber,
          }))
        )
        .reduce((acc, inst) => {
          const key = inst.installmentName;
          if (!acc[key]) acc[key] = [];
          acc[key].push(inst);
          return acc;
        }, {});


      const allInstallments = feesStructures.flatMap((s) => s.installments);
      const uniqueInstallmentNames = [...new Set(allInstallments.map((i) => i.name))];

      const sortedInstallments = uniqueInstallmentNames.sort((a, b) => {
        const dueA = allInstallments.find((i) => i.name === a)?.dueDate;
        const dueB = allInstallments.find((i) => i.name === b)?.dueDate;
        return dueA && dueB ? new Date(dueA) - new Date(dueB) : 0;
      });

      const targetInstallments = installment ? [installment] : sortedInstallments;

   
      let firstFullyPaidIndex = -1;
      for (let i = 0; i < sortedInstallments.length; i++) {
        const instName = sortedInstallments[i];
        const structureInst = allInstallments.find((i) => i.name === instName);
        if (!structureInst) continue;

        let totalDue = 0, totalPaid = 0, totalConcession = 0, totalRefund = 0;

        for (const fee of structureInst.fees) totalDue += fee.amount || 0;

        const payments = paymentsByInstallment[instName] || [];
        for (const p of payments) {
          for (const item of p.feeItems) {
            totalPaid += item.paid || 0;
            totalConcession += item.concession || 0;
          }
        }

        const relevantRefunds = refunds.filter(
          (r) =>
            r.installmentName === instName ||
            r.feeTypeRefunds.some((ftr) => ftr.installmentName === instName)
        );

        for (const r of relevantRefunds) {
          for (const ftr of r.feeTypeRefunds || []) {
            totalRefund += (ftr.refundAmount || 0) + (ftr.cancelledAmount || 0);
            totalConcession += ftr.concessionAmount || 0;
          }
        }

        totalPaid = Math.max(0, totalPaid - totalRefund);
        const netDue = totalDue - totalConcession;

        if (totalPaid >= netDue && netDue > 0) {
          firstFullyPaidIndex = i;
          break;
        }
      }

      if (firstFullyPaidIndex === -1) continue;

      // Collect unpaid/partially paid earlier installments
      const unpaidInstallments = [];

      for (let i = 0; i < firstFullyPaidIndex; i++) {
        const instName = sortedInstallments[i];
        if (!targetInstallments.includes(instName)) continue;

        const structureInst = allInstallments.find((i) => i.name === instName);
        if (!structureInst || !structureInst.dueDate) continue;

        let feeTypeDetails = [];
        let totalFeesDue = 0, totalFeesPaid = 0, totalConcession = 0;

        // Initialize fee types
        for (const fee of structureInst.fees) {
          const feeTypeName = feeTypeMap[fee.feesTypeId?.toString()] || "Unknown";
          feeTypeDetails.push({
            feeType: feeTypeName,
            dueAmount: fee.amount || 0,
            paidAmount: 0,
            concession: 0,
            refundAmount: 0,
            refundConcession: 0,
            balance: fee.amount || 0,
          });
          totalFeesDue += fee.amount || 0;
        }

        // Apply payments
        const payments = paymentsByInstallment[instName] || [];
        for (const p of payments) {
          for (const item of p.feeItems) {
            const feeTypeName = feeTypeMap[item.feesTypeId?.toString()] || "Unknown";
            const ft = feeTypeDetails.find((f) => f.feeType === feeTypeName);
            if (ft) {
              ft.paidAmount += item.paid || 0;
              ft.concession += item.concession || 0;
            }
          }
        }

        // Apply refunds
        const relevantRefunds = refunds.filter(
          (r) =>
            r.installmentName === instName ||
            r.feeTypeRefunds.some((ftr) => ftr.installmentName === instName)
        );

        for (const r of relevantRefunds) {
          const refundItems = r.installmentName
            ? [{ ...r, feesTypeId: null }]
            : (r.feeTypeRefunds || []);

          for (const item of refundItems) {
            const feeTypeName = feeTypeMap[item.feesTypeId?.toString()] || "Unknown";
            const ft = feeTypeDetails.find((f) => f.feeType === feeTypeName);
            if (ft) {
              ft.refundAmount += (item.refundAmount || 0) + (item.cancelledAmount || 0);
              ft.refundConcession += item.concessionAmount || 0;
            }
          }
        }

        // Finalize balances
        for (const ft of feeTypeDetails) {
          ft.paidAmount = Math.max(0, ft.paidAmount - ft.refundAmount);
          ft.concession = Math.max(0, ft.concession - ft.refundConcession);
          ft.balance = (ft.dueAmount - ft.concession) - ft.paidAmount;
          totalFeesPaid += ft.paidAmount;
          totalConcession += ft.concession;
        }

        const netDue = totalFeesDue - totalConcession;
        const isUnpaidOrPartial = totalFeesPaid < netDue;

        if (isUnpaidOrPartial) {
          unpaidInstallments.push({
            installmentName: instName,
            dueDate: structureInst.dueDate
              ? new Date(structureInst.dueDate).toLocaleDateString("en-GB")
              : null,
            paymentMode: payments[0]?.paymentMode || "-",
            paymentDate: payments[0]?.paymentDate
              ? new Date(payments[0].paymentDate).toLocaleDateString("en-GB")
              : "-",
            feesDue: totalFeesDue,
            feesPaid: totalFeesPaid,
            concession: totalConcession,
            balance: netDue - totalFeesPaid,
            feeTypeDetails,
          });
        }
      }

      if (unpaidInstallments.length === 0) continue;

      // Totals per student
      const totals = unpaidInstallments.reduce(
        (acc, inst) => {
          acc.totalFeesDue += inst.feesDue;
          acc.totalFeesPaid += inst.feesPaid;
          acc.totalConcession += inst.concession;
          acc.totalBalance += inst.balance;
          return acc;
        },
        { totalFeesDue: 0, totalFeesPaid: 0, totalConcession: 0, totalBalance: 0 }
      );

      result.push({
        admissionNumber,
        studentName: `${student.firstName} ${student.lastName || ''}`.trim(),
        className: classMap[masterDefineClass] || masterDefineClass,
        sectionName: sectionMap[section] || section,
        academicYear,
        TCStatus: student.TCStatus || 'Active',
        admissionPaymentDate: firstAdmissionPayment
          ? new Date(firstAdmissionPayment.paymentDate).toLocaleDateString("en-GB")
          : null,
        installments: unpaidInstallments,
        totals,
      });
    }

    // No matching students
    if (result.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "No students found with unpaid/partially paid earlier installments",
      });
    }

    // Filter Options
    const classOptions = Array.from(new Set(Object.values(classMap))).map((name) => ({
      value: name,
      label: name,
    }));

    const sectionOptions = Array.from(new Set(Object.values(sectionMap))).map((name) => ({
      value: name,
      label: name,
    }));

    const installmentOptions = Array.from(
      new Set(result.flatMap((r) => r.installments.map((i) => i.installmentName)))
    ).map((name) => ({ value: name, label: name }));

    const paymentModeOptions = Array.from(
      new Set(
        (await SchoolFees.find({ schoolId, academicYear }).lean().session(session))
          .map((f) => f.paymentMode)
          .filter(Boolean)
      )
    ).map((mode) => ({ value: mode, label: mode }));

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      data: result,
      feeTypes: allFeeTypes,
      filterOptions: {
        classOptions,
        sectionOptions,
        installmentOptions,
        paymentModeOptions,
      },
    });
  } catch (error) {
    console.error("Error in LateAdmissionUnpaidEarlierInstallments:", error);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export default LateAdmissionUnpaidEarlierInstallments;
