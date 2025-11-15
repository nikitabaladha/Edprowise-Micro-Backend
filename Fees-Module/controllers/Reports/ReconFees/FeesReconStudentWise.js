import FeesStructure from "../../../models/FeesStructure.js";
import FeesType from "../../../models/FeesType.js";
import ConcessionFormModel from "../../../models/ConcessionForm.js";
import AdmissionForm from "../../../models/AdmissionForm.js";
import { SchoolFees } from "../../../models/SchoolFees.js";
import ClassAndSection from "../../../models/Class&Section.js";

export const FeesReconStudentWise = async (req, res) => {
  try {
    const { schoolId, academicYear } = req.query;
    if (!schoolId || !academicYear) {
      return res.status(400).json({
        message: 'schoolId and academicYear are required',
      });
    }

    const students = await AdmissionForm.find({ schoolId, academicYear }).lean();
    if (!students.length) {
      return res.status(404).json({ message: "No students found for the school" });
    }

    const classAndSections = await ClassAndSection.find({ schoolId }).lean();
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

    const feeTypes = await FeesType.find().lean();
    const feeTypeMap = feeTypes.reduce((acc, type) => {
      acc[type._id.toString()] = type.name;
      return acc;
    }, {});

    const result = [];
    const allFeeTypes = feeTypes.map((type) => type.name).sort();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const student of students) {
      const admissionNumber = student.AdmissionNumber;
      const academicHistory = student.academicHistory.find(
        (history) => history.academicYear === academicYear
      );

      if (!academicHistory) continue;

      const { masterDefineClass, section } = academicHistory;

      const feesStructures = await FeesStructure.find({
        schoolId,
        classId: masterDefineClass,
        sectionIds: { $in: [section] },
        academicYear: academicYear
      }).lean();

      if (!feesStructures.length) continue;

      const concessionForm = await ConcessionFormModel.findOne({
        AdmissionNumber: { $regex: `^${admissionNumber}$`, $options: "i" },
        academicYear: academicYear
      }).lean();

      const allPaidFeesData = await SchoolFees.find({
        schoolId,
        studentAdmissionNumber: admissionNumber,
        academicYear
      }).lean();

      const installments = [];


      const allStructureInstallments = feesStructures
        .flatMap((structure) => structure.installments)
        .map((inst) => inst.name);

      const paidInstallments = allPaidFeesData
        .flatMap((payment) =>
          payment.installments.map((inst) => inst.installmentName)
        )
        .filter(Boolean);

      const allInstallments = [...new Set([...allStructureInstallments, ...paidInstallments])];


      const paymentsByInstallment = allPaidFeesData
        .flatMap((payment) =>
          payment.installments.map((inst) => ({
            type: "Paid",
            installmentName: inst.installmentName,
            paymentDate: payment.paymentDate,
            paymentMode: payment.paymentMode || "-",
            reportStatus: payment.reportStatus || [],
            cancelledDate: payment.cancelledDate,
            feeItems: inst.feeItems,
            totalCancelledPaidAmount: inst.feeItems.reduce(
              (s, fi) => s + (fi.cancelledPaidAmount || 0),
              0
            ),
          }))
        )
        .reduce((acc, inst) => {
          const n = inst.installmentName;
          if (!acc[n]) acc[n] = [];
          acc[n].push(inst);
          return acc;
        }, {});


      for (const instName of allInstallments) {
        const structureInst = feesStructures
          .flatMap((s) => s.installments)
          .find((i) => i.name === instName);

        if (!structureInst) continue;


        const dueDateRaw = structureInst.dueDate;
        const dueDate = dueDateRaw
          ? new Date(dueDateRaw).toLocaleDateString("en-GB")
          : null;

        const dueDateObj = dueDateRaw ? new Date(dueDateRaw) : null;
        dueDateObj?.setHours(0, 0, 0, 0);


        let initialFeesDue = 0;
        for (const f of structureInst.fees) initialFeesDue += f.amount || 0;

        let currentFeesDue = initialFeesDue;
        const instPayments = paymentsByInstallment[instName] || [];


        const hasAnyPayment = instPayments.length > 0;
        const isFutureDue = dueDateObj && dueDateObj > today;

        if (isFutureDue && !hasAnyPayment) {

          continue;
        }


        if (!hasAnyPayment) {
          let concession = 0;
          if (concessionForm?.concessionDetails?.length) {
            for (const fee of structureInst.fees) {
              const match = concessionForm.concessionDetails.find(
                (c) =>
                  c.installmentName === instName &&
                  c.feesType.toString() === fee.feesTypeId.toString()
              );
              if (match) concession += match.concessionAmount || 0;
            }
          }

          const balance = initialFeesDue - concession;

          installments.push({
            type: "Unpaid",
            installmentName: instName,
            feesDue: initialFeesDue,
            feesPaid: 0,
            cancelled: 0,
            concession,
            balance,
            dueDate,
            paymentDate: null,
            cancelledDate: null,
            reportStatus: [],
            paymentMode: "-",
            feeTypes: structureInst.fees.reduce((acc, cur) => {
              const n = feeTypeMap[cur.feesTypeId.toString()];
              if (n) acc[n] = cur.amount || 0;
              return acc;
            }, {}),
            cancelledByFeeType: {},
          });
          continue;
        }


        const sortedEntries = instPayments
          .map((p) => ({ ...p, sortDate: new Date(p.paymentDate) }))
          .sort((a, b) => a.sortDate - b.sortDate);

        for (const entry of sortedEntries) {
          let feesDue = currentFeesDue;
          let feesPaid = 0;
          let cancelled = 0;
          let concession = 0;
          let paymentDate = new Date(entry.paymentDate).toLocaleDateString(
            "en-GB"
          );
          let cancelledDate = entry.cancelledDate
            ? new Date(entry.cancelledDate).toLocaleDateString("en-GB")
            : null;
          let reportStatus = entry.reportStatus || [];
          let paymentMode = entry.paymentMode || "-";

          for (const fi of entry.feeItems) {
            feesPaid += fi.paid || 0;
            cancelled += fi.cancelledPaidAmount || 0;
          }


          if (cancelled === 0 && concessionForm?.concessionDetails?.length) {
            for (const fee of structureInst.fees) {
              const match = concessionForm.concessionDetails.find(
                (c) =>
                  c.installmentName === instName &&
                  c.feesType.toString() === fee.feesTypeId.toString()
              );
              if (match) concession += match.concessionAmount || 0;
            }
          }

          const effectivePaid = feesPaid - cancelled;
          const balance = currentFeesDue - effectivePaid - concession;

          installments.push({
            type: entry.type,
            installmentName: instName,
            feesDue,
            feesPaid,
            cancelled,
            concession,
            balance,
            dueDate,
            paymentDate,
            cancelledDate,
            reportStatus,
            paymentMode,
            feeTypes: structureInst.fees.reduce((acc, cur) => {
              const n = feeTypeMap[cur.feesTypeId.toString()];
              if (n) acc[n] = cur.amount || 0;
              return acc;
            }, {}),
            cancelledByFeeType: entry.feeItems.reduce((acc, fi) => {
              const n = feeTypeMap[fi.feeTypeId?.toString()];
              if (n && (fi.cancelledPaidAmount || 0) > 0) {
                acc[n] = (acc[n] || 0) + (fi.cancelledPaidAmount || 0);
              }
              return acc;
            }, {}),
          });

          currentFeesDue = balance;
        }
      }


      if (installments.length > 0) {
        const uniqInst = [...new Set(installments.map((i) => i.installmentName))];
        let totalFeesDue = 0,
          totalFeesPaid = 0,
          totalCancelled = 0,
          totalConcession = 0,
          totalBalance = 0;

        for (const n of uniqInst) {
          const entries = installments.filter((i) => i.installmentName === n);
          const first = entries[0];
          totalFeesDue += first.feesDue;
          totalFeesPaid += entries.reduce((s, i) => s + i.feesPaid, 0);
          totalCancelled += entries.reduce((s, i) => s + i.cancelled, 0);
          totalConcession += entries.reduce((s, i) => s + (i.concession || 0), 0);
          totalBalance += entries[entries.length - 1].balance;
        }

        result.push({
          admissionNumber,
          studentName: `${student.firstName} ${student.lastName || ""}`.trim(),
          className: classMap[masterDefineClass] || masterDefineClass,
          sectionName: sectionMap[section] || section,
          academicYear: student.academicYear,
          installments,
          totals: {
            totalFeesDue,
            totalFeesPaid,
            totalCancelled,
            totalConcession,
            totalBalance,
          },
        });
      }
    }

    if (!result.length) {
      return res
        .status(404)
        .json({ message: "No fee data found for the given academic year" });
    }


    const classOptions = Array.from(new Set(Object.values(classMap))).map(
      (n) => ({ value: n, label: n })
    );
    const sectionOptions = Array.from(new Set(Object.values(sectionMap))).map(
      (n) => ({ value: n, label: n })
    );
    const installmentOptions = Array.from(
      new Set(
        result.flatMap((i) => i.installments.map((inst) => inst.installmentName))
      )
    ).map((i) => ({ value: i, label: i }));

    const paymentModeOptions = Array.from(
      new Set(
        (
          await SchoolFees.find({ schoolId, academicYear }).lean()
        )
          .map((f) => f.paymentMode)
          .filter(Boolean)
      )
    ).map((m) => ({ value: m, label: m }));

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
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export default FeesReconStudentWise;
