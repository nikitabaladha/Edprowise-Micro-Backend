import mongoose from "mongoose";
import FeesStructure from "../../../models/FeesStructure.js";
import FeesType from "../../../models/FeesType.js";
import ConcessionFormModel from "../../../models/ConcessionForm.js";
import AdmissionForm from "../../../models/AdmissionForm.js";
import { SchoolFees } from "../../../models/SchoolFees.js";
import ClassAndSection from "../../../models/Class&Section.js";
import Refund from "../../../models/RefundFees.js";

export const getAllStudentFeesDue = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { schoolId, academicYear, classes, sections, installment } =
      req.query;
    if (!schoolId || !academicYear) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "schoolId and academicYear are required" });
    }

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
      item.sections.forEach((sec) => {
        acc[sec._id.toString()] = sec.name;
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

    const students = await AdmissionForm.find({
      schoolId,
      TCStatus: "Inactive",
    })
      .select(
        "AdmissionNumber firstName lastName academicHistory dropoutStatus TCStatus TCStatusDate"
      )
      .lean()
      .session(session);

    if (!students.length) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ message: "No inactive students found for the school" });
    }

    const feeTypes = await FeesType.find({ academicYear })
      .lean()
      .session(session);
    const feeTypeMap = feeTypes.reduce((acc, type) => {
      acc[type._id.toString()] = type.feesTypeName;
      return acc;
    }, {});
    const allFeeTypes = feeTypes.map((t) => t.feesTypeName).sort();

    const result = [];

    for (const student of students) {
      const admissionNumber = student.AdmissionNumber;
      const academicHistory = student.academicHistory.find(
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

      const concessionForm = await ConcessionFormModel.findOne({
        AdmissionNumber: { $regex: `^${admissionNumber}$`, $options: "i" },
        academicYear,
      })
        .lean()
        .session(session);

      const allPaidFeesData = await SchoolFees.find({
        schoolId,
        studentAdmissionNumber: admissionNumber,
        academicYear,
        reportStatus: "Paid",
      })
        .lean()
        .session(session);

      const refunds = await Refund.find({
        schoolId,
        admissionNumber,
        academicYear,
        refundType: "School Fees",
        status: { $in: ["Refund", "Cancelled", "Cheque Return"] },
      })
        .lean()
        .session(session);

      const expectedInstallments = feesStructures
        .flatMap((s) => s.installments)
        .map((i) => i.name)
        .filter((v, i, a) => a.indexOf(v) === i);

      const filteredInstallments = installment
        ? [installment]
        : expectedInstallments;

      const paymentsByInstallment = allPaidFeesData
        .flatMap((payment) =>
          payment.installments.map((inst) => ({
            ...inst,
            paymentDate: payment.paymentDate,
            paymentMode: payment.paymentMode || "-",
          }))
        )
        .reduce((acc, inst) => {
          const name = inst.installmentName;
          if (!acc[name]) acc[name] = [];
          acc[name].push(inst);
          return acc;
        }, {});

      const installments = [];

      for (const instName of filteredInstallments) {
        const structureInst = feesStructures
          .flatMap((s) => s.installments)
          .find((i) => i.name === instName);
        if (!structureInst) continue;

        const baseAmounts = {};
        let totalDue = 0;
        for (const fee of structureInst.fees) {
          const ftId = fee.feesTypeId.toString();
          const amt = fee.amount || 0;
          baseAmounts[ftId] = amt;
          totalDue += amt;
        }

        const concessionByType = {};
        let totalConcession = 0;
        if (concessionForm?.concessionDetails?.length) {
          for (const fee of structureInst.fees) {
            const match = concessionForm.concessionDetails.find(
              (c) =>
                c.installmentName === instName &&
                c.feesType.toString() === fee.feesTypeId.toString()
            );
            if (match) {
              const amt = match.concessionAmount || 0;
              concessionByType[fee.feesTypeId.toString()] = amt;
              totalConcession += amt;
            }
          }
        }

        const paidByType = {};
        let totalPaid = 0;
        const payments = paymentsByInstallment[instName] || [];
        for (const payment of payments) {
          for (const item of payment.feeItems) {
            const ftId = item.feeTypeId?.toString();
            if (!ftId) continue;
            const p = item.paid || 0;
            paidByType[ftId] = (paidByType[ftId] || 0) + p;
            totalPaid += p;
          }
        }

        const refundByType = {};
        let totalRefunded = 0;
        const relevantRefunds = refunds.filter(
          (r) =>
            r.feeTypeRefunds?.some((f) => f.installmentName === instName) ||
            r.installmentName === instName
        );

        for (const refund of relevantRefunds) {
          const perType =
            refund.feeTypeRefunds?.filter(
              (f) => f.installmentName === instName
            ) || [];
          for (const f of perType) {
            const ftId = f.feeTypeId?.toString();
            if (!ftId) continue;
            const amt = (f.refundAmount || 0) + (f.cancelledAmount || 0);
            refundByType[ftId] = (refundByType[ftId] || 0) + amt;
            totalRefunded += amt;
          }

          if (refund.installmentName === instName) {
            const amt =
              (refund.refundAmount || 0) + (refund.cancelledAmount || 0);
            totalRefunded += amt;
          }
        }

        const netPaidByType = {};
        let netTotalPaid = 0;
        for (const ftId of Object.keys(paidByType)) {
          const net = Math.max(0, paidByType[ftId] - (refundByType[ftId] || 0));
          netPaidByType[ftId] = net;
          netTotalPaid += net;
        }

        const feeTypeDetails = [];
        let runningBalance = totalDue - totalConcession;

        for (const fee of structureInst.fees) {
          const ftId = fee.feesTypeId.toString();
          const due = baseAmounts[ftId] || 0;
          const conc = concessionByType[ftId] || 0;
          const paid = netPaidByType[ftId] || 0;

          const balance = due - conc - paid;
          runningBalance -= paid;

          feeTypeDetails.push({
            feeType: feeTypeMap[ftId] || "Unknown",
            dueAmount: due,
            paidAmount: paid,
            concession: conc,
            refundAmount: refundByType[ftId] || 0,
            refundConcession: 0,
            balance: balance > 0 ? balance : 0,
          });
        }

        const netDue = totalDue - totalConcession;
        const installmentBalance = netDue - netTotalPaid;

        if (payments.length) {
          for (const payment of payments) {
            let paidThisPayment = 0;
            for (const item of payment.feeItems) {
              const ftId = item.feeTypeId?.toString();
              if (ftId) paidThisPayment += item.paid || 0;
            }

            const netPaidThisPayment = Math.max(
              0,
              paidThisPayment - totalRefunded
            );

            installments.push({
              paymentDate: new Date(payment.paymentDate).toLocaleDateString(
                "en-GB"
              ),
              paymentMode: payment.paymentMode || "-",
              installmentName: instName,
              feesDue: netDue,
              feesPaid: netPaidThisPayment,
              concession: totalConcession,
              balance: Math.max(0, netDue - netPaidThisPayment),
              feeTypeDetails,

              feeTypes: Object.fromEntries(
                feeTypeDetails.map((d) => [d.feeType, d.dueAmount])
              ),
            });
          }
        } else {
          installments.push({
            paymentDate: "-",
            paymentMode: "-",
            installmentName: instName,
            feesDue: netDue,
            feesPaid: 0,
            concession: totalConcession,
            balance: installmentBalance,
            feeTypeDetails,
            feeTypes: Object.fromEntries(
              feeTypeDetails.map((d) => [d.feeType, d.dueAmount])
            ),
          });
        }
      }

      if (installments.length) {
        const uniqueInst = [
          ...new Set(installments.map((i) => i.installmentName)),
        ];
        let totalFeesDue = 0,
          totalFeesPaid = 0,
          totalConcession = 0,
          totalBalance = 0;

        for (const name of uniqueInst) {
          const rows = installments.filter((i) => i.installmentName === name);
          const first = rows[0];
          totalFeesDue += first.feesDue;
          totalFeesPaid += rows.reduce((s, r) => s + r.feesPaid, 0);
          totalConcession += rows.reduce((s, r) => s + r.concession, 0);
          totalBalance += rows[rows.length - 1].balance;
        }

        let remark = "";
        if (student.dropoutStatus == null) remark = "TC";
        else if (student.dropoutStatus === "Dropout") remark = "Dropout";

        result.push({
          admissionNumber,
          studentName: `${student.firstName} ${student.lastName || ""}`.trim(),
          className: classMap[masterDefineClass] || masterDefineClass,
          sectionName: sectionMap[section] || section,
          academicYear,
          TCStatus: student.TCStatus,
          TCStatusDate: student.TCStatusDate
            ? new Date(student.TCStatusDate).toLocaleDateString("en-GB")
            : "-",
          Remark: remark,
          installments,
          totals: {
            totalFeesDue,
            totalFeesPaid,
            totalConcession,
            totalBalance,
          },
        });
      }
    }

    if (!result.length) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ message: "No fee data found for the given academic year" });
    }

    const classOptions = Array.from(new Set(Object.values(classMap))).map(
      (n) => ({
        value: n,
        label: n,
      })
    );
    const sectionOptions = Array.from(new Set(Object.values(sectionMap))).map(
      (n) => ({
        value: n,
        label: n,
      })
    );
    const installmentOptions = Array.from(
      new Set(
        result.flatMap((r) => r.installments.map((i) => i.installmentName))
      )
    ).map((n) => ({ value: n, label: n }));

    const paymentModeOptions = Array.from(
      new Set(
        (
          await SchoolFees.find({
            schoolId,
            academicYear,
            reportStatus: "Paid",
          })
            .lean()
            .session(session)
        ).map((f) => f.paymentMode)
      )
    )
      .filter(Boolean)
      .map((m) => ({ value: m, label: m }));

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
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
    console.error("Error fetching student fees due:", error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: "Server error" });
  }
};

export default getAllStudentFeesDue;
