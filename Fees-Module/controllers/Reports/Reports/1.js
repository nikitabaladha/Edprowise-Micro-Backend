import { SchoolFees } from "../../../models/SchoolFees.js";
import FeesType from "../../../models/FeesType.js";
import AdmissionForm from "../../../models/AdmissionForm.js";
import StudentRegistration from "../../../models/RegistrationForm.js";
import TCForm from "../../../models/TCForm.js";
import ClassAndSection from "../../../models/Class&Section.js";
import FeesStructure from "../../../models/FeesStructure.js";
import FeesManagementYear from "../../../models/FeesManagementYear.js";
import BoardExamFeePayment from "../../../models/BoardExamFeePayment.js";
import BoardRegistrationFeePayment from "../../../models/BoardRegistrationFeePayment.js";
import RefundFees from "../../../models/RefundFees.js";

export const getTotalPaidFeeTypes = async (req, res) => {
  try {
    const { schoolId, academicYear } = req.query;

    if (!schoolId || !academicYear) {
      return res.status(400).json({
        message: "schoolId and academicYear are required",
      });
    }

    const schoolIdString = schoolId.trim();

    const academicYearData = await FeesManagementYear.findOne({
      schoolId: schoolIdString,
      academicYear,
    });
    if (!academicYearData) {
      return res.status(400).json({
        message: `Academic year ${academicYear} not found for schoolId ${schoolIdString}`,
      });
    }
    const { startDate, endDate } = academicYearData;

    const feeTypes = await FeesType.find({ schoolId: schoolIdString });
    const feeTypeMap = feeTypes.reduce((acc, type) => {
      acc[type._id.toString()] = type.feesTypeName;
      return acc;
    }, {});
    feeTypeMap["Admission Fees"] = "Admission Fees";
    feeTypeMap["Registration Fees"] = "Registration Fees";
    feeTypeMap["TC Fees"] = "TC Fees";
    feeTypeMap["Board Exam Fees"] = "Board Exam Fees";
    feeTypeMap["Board Registration Fees"] = "Board Registration Fees";

    const academicYears = await FeesStructure.distinct("academicYear", {
      schoolId: schoolIdString,
    });
    const academicYearOptions = academicYears
      .sort((a, b) => a.localeCompare(b))
      .map((year) => ({
        value: year,
        label:
          year.split("-").length === 2
            ? `${year.split("-")[0]}-${year.split("-")[1].slice(-2)}`
            : year,
      }));

    const classResponse = await ClassAndSection.find({
      schoolId: schoolIdString,
      academicYear,
    }).lean();
    const classOptions = [
      ...new Set(classResponse.map((cls) => cls.className)),
    ].map((cls) => ({
      value: cls,
      label: cls,
    }));
    const sectionOptions = [
      ...new Set(
        classResponse.flatMap((cls) =>
          cls.sections.map((sec) => sec.name).filter((sec) => sec)
        )
      ),
    ].map((sec) => ({
      value: sec,
      label: sec,
    }));

    const feesStructures = await FeesStructure.find({
      schoolId: schoolIdString,
    }).lean();
    const installmentOptions = [
      ...new Set(
        feesStructures.flatMap((fs) => fs.installments.map((inst) => inst.name))
      ),
    ].map((inst) => ({
      value: inst,
      label: inst,
    }));

    // ----------------- School Fees -----------------
    const schoolFeesAggregation = await SchoolFees.aggregate([
      {
        $match: {
          schoolId: schoolIdString,
          paymentDate: { $gte: startDate, $lte: endDate },
          status: { $in: ["Paid", "Cancelled", "Cheque Return"] },
        },
      },
      {
        $lookup: {
          from: "admissionforms",
          localField: "studentAdmissionNumber",
          foreignField: "AdmissionNumber",
          as: "admissionData",
        },
      },
      { $unwind: { path: "$admissionData", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "classandsections",
          let: {
            classId: "$admissionData.academicHistory.masterDefineClass",
            academicYear: "$academicYear",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$classId"] },
                    { $eq: ["$academicYear", "$$academicYear"] },
                    { $eq: ["$schoolId", schoolIdString] },
                  ],
                },
              },
            },
            { $project: { className: 1, sections: 1 } },
          ],
          as: "classData",
        },
      },
      { $unwind: { path: "$classData", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          sectionData: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$classData.sections",
                  as: "section",
                  cond: {
                    $eq: [
                      "$$section._id",
                      "$admissionData.academicHistory.section",
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      { $unwind: "$installments" },
      {
        $group: {
          _id: {
            academicYear: "$academicYear",
            paymentDate: {
              $dateToString: { format: "%d-%m-%Y", date: "$paymentDate" },
            },
            cancelledDate: {
              $dateToString: { format: "%d-%m-%Y", date: "$cancelledDate" },
            },
            paymentMode: "$paymentMode",
            className: "$classData.className",
            sectionName: "$sectionData.name",
            installmentName: "$installments.installmentName",
            status: "$status",
            studentAdmissionNumber: "$studentAdmissionNumber",
            studentName: "$studentName",
            receiptNumber: "$receiptNumber",
          },
          fineAmount: { $first: "$installments.fineAmount" },
          excessAmount: { $first: "$installments.excessAmount" },
          feeItems: { $push: "$installments.feeItems" },
        },
      },
      { $unwind: "$feeItems" },
      { $unwind: "$feeItems" },
      {
        $group: {
          _id: {
            academicYear: "$_id.academicYear",
            paymentDate: "$_id.paymentDate",
            cancelledDate: "$_id.cancelledDate",
            paymentMode: "$_id.paymentMode",
            feeTypeId: "$feeItems.feeTypeId",
            className: "$_id.className",
            sectionName: "$_id.sectionName",
            installmentName: "$_id.installmentName",
            status: "$_id.status",
            studentAdmissionNumber: "$_id.studentAdmissionNumber",
            studentName: "$_id.studentName",
            receiptNumber: "$_id.receiptNumber",
          },
          totalPaid: {
            $sum: {
              $cond: [
                { $eq: ["$_id.status", "Paid"] },
                "$feeItems.paid",
                "$feeItems.cancelledPaidAmount",
              ],
            },
          },
          fineAmount: { $first: "$fineAmount" },
          excessAmount: { $first: "$excessAmount" },
        },
      },
    ]);

    // ----------------- Admission Fees -----------------
    const admissionFeesAggregation = await AdmissionForm.aggregate([
      {
        $match: {
          schoolId: schoolIdString,
          paymentDate: { $gte: startDate, $lte: endDate },
          admissionFees: { $gt: 0 },
          status: { $in: ["Paid", "Cancelled", "Cheque Return"] },
        },
      },

      { $unwind: "$academicHistory" },

      {
        $lookup: {
          from: "classandsections",
          let: {
            classId: "$academicHistory.masterDefineClass",
            academicYear: "$academicYear",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$classId"] },
                    { $eq: ["$academicYear", "$$academicYear"] },
                    { $eq: ["$schoolId", schoolIdString] },
                  ],
                },
              },
            },
            { $project: { className: 1 } },
          ],
          as: "classData",
        },
      },
      {
        $lookup: {
          from: "classandsections",
          let: {
            sectionId: "$academicHistory.section",
            academicYear: "$academicYear",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$academicYear", "$$academicYear"] },
                    { $eq: ["$schoolId", schoolIdString] },
                  ],
                },
              },
            },
            { $unwind: "$sections" },
            {
              $match: {
                $expr: { $eq: ["$sections._id", "$$sectionId"] },
              },
            },
            { $project: { sectionName: "$sections.name" } },
          ],
          as: "sectionData",
        },
      },
      { $unwind: { path: "$classData", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$sectionData", preserveNullAndEmptyArrays: true } },

      {
        $group: {
          _id: {
            academicYear: "$academicYear",
            paymentDate: {
              $dateToString: { format: "%d-%m-%Y", date: "$paymentDate" },
            },
            cancelledDate: {
              $dateToString: { format: "%d-%m-%Y", date: "$cancelledDate" },
            },
            paymentMode: "$paymentMode",
            className: "$classData.className",
            sectionName: "$sectionData.sectionName",
            status: "$status",
            studentAdmissionNumber: "$AdmissionNumber",
            studentName: { $concat: ["$firstName", " ", "$lastName"] },
            receiptNumber: "$receiptNumber",
          },
          totalPaid: { $sum: "$admissionFees" },
        },
      },
      {
        $addFields: {
          feeTypeId: "Admission Fees",
          installmentName: null,
          fineAmount: 0,
          excessAmount: 0,
        },
      },
    ]);

    // ----------------- Registration Fees -----------------
    const registrationFeesAggregation = await StudentRegistration.aggregate([
      {
        $match: {
          schoolId: schoolIdString,
          $or: [
            { paymentDate: { $gte: startDate, $lte: endDate } },
            { cancelledDate: { $gte: startDate, $lte: endDate } },
          ],
          registrationFee: { $gt: 0 },
          status: { $in: ["Paid", "Cancelled", "Cheque Return"] },
        },
      },
      {
        $lookup: {
          from: "classandsections",
          localField: "masterDefineClass",
          foreignField: "_id",
          as: "classData",
        },
      },
      { $unwind: { path: "$classData", preserveNullAndEmptyArrays: true } },

      {
        $group: {
          _id: {
            academicYear: "$academicYear",
            paymentDate: {
              $dateToString: { format: "%d-%m-%Y", date: "$paymentDate" },
            },
            cancelledDate: {
              $dateToString: { format: "%d-%m-%Y", date: "$cancelledDate" },
            },
            paymentMode: "$paymentMode",
            className: "$classData.className",
            sectionName: null,
            status: "$status",
            studentAdmissionNumber: "$registrationNumber",
            studentName: { $concat: ["$firstName", " ", "$lastName"] },
            receiptNumber: "$receiptNumber",
          },
          totalPaid: { $sum: "$registrationFee" },
        },
      },
      {
        $addFields: {
          feeTypeId: "Registration Fees",
          installmentName: null,
          fineAmount: 0,
          excessAmount: 0,
        },
      },
    ]);

    // ----------------- TC Fees -----------------
    const tcFeesAggregation = await TCForm.aggregate([
      {
        $match: {
          schoolId: schoolIdString,
          paymentDate: { $gte: startDate, $lte: endDate },
          TCfees: { $gt: 0 },
          status: { $in: ["Paid", "Cancelled", "Cheque Return"] },
        },
      },
      {
        $lookup: {
          from: "classandsections",
          localField: "masterDefineClass",
          foreignField: "_id",
          as: "classData",
        },
      },
      { $unwind: { path: "$classData", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            academicYear: "$academicYear",
            paymentDate: {
              $dateToString: { format: "%d-%m-%Y", date: "$paymentDate" },
            },
            cancelledDate: {
              $dateToString: { format: "%d-%m-%Y", date: "$cancelledDate" },
            },
            paymentMode: "$paymentMode",
            className: "$classData.className",
            sectionName: null,
            status: "$status",
            studentAdmissionNumber: "$AdmissionNumber",
            studentName: { $concat: ["$firstName", " ", "$lastName"] },
            receiptNumber: "$receiptNumber",
          },
          totalPaid: { $sum: "$TCfees" },
        },
      },
      {
        $addFields: {
          feeTypeId: "TC Fees",
          installmentName: null,
          fineAmount: 0,
          excessAmount: 0,
        },
      },
    ]);

    // ----------------- Board Exam Fees -----------------
    const boardExamFeesAggregation = await BoardExamFeePayment.aggregate([
      {
        $match: {
          schoolId: schoolIdString,
          paymentDate: { $gte: startDate, $lte: endDate },
          amount: { $gt: 0 },
          status: { $in: ["Paid", "Cancelled", "Cheque Return"] },
        },
      },
      {
        $lookup: {
          from: "classandsections",
          localField: "classId",
          foreignField: "_id",
          as: "classData",
        },
      },
      { $unwind: { path: "$classData", preserveNullAndEmptyArrays: true } },
      {
        $unwind: {
          path: "$classData.sections",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $expr: { $eq: ["$classData.sections._id", "$sectionId"] },
        },
      },
      {
        $group: {
          _id: {
            academicYear: "$academicYear",
            paymentDate: {
              $dateToString: { format: "%d-%m-%Y", date: "$paymentDate" },
            },
            cancelledDate: {
              $dateToString: { format: "%d-%m-%Y", date: "$cancelledDate" },
            },
            paymentMode: "$paymentMode",
            className: "$classData.className",
            sectionName: "$classData.sections.name",
            status: "$status",
            studentAdmissionNumber: "$admissionNumber",
            studentName: "$studentName",
            receiptNumber: "$receiptNumberBef",
          },
          totalPaid: { $sum: "$amount" },
        },
      },
      {
        $addFields: {
          feeTypeId: "Board Exam Fees",
          installmentName: null,
          fineAmount: 0,
          excessAmount: 0,
        },
      },
    ]);

    // ----------------- Board Registration Fees -----------------
    const boardRegistrationFeesAggregation =
      await BoardRegistrationFeePayment.aggregate([
        {
          $match: {
            schoolId: schoolIdString,
            paymentDate: { $gte: startDate, $lte: endDate },
            amount: { $gt: 0 },
            status: { $in: ["Paid", "Cancelled", "Cheque Return"] },
          },
        },
        {
          $lookup: {
            from: "classandsections",
            localField: "classId",
            foreignField: "_id",
            as: "classData",
          },
        },
        { $unwind: { path: "$classData", preserveNullAndEmptyArrays: true } },
        {
          $unwind: {
            path: "$classData.sections",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            $expr: { $eq: ["$classData.sections._id", "$sectionId"] },
          },
        },
        {
          $addFields: {
            className: "$classData.className",
            sectionName: "$classData.sections.name",
          },
        },

        {
          $group: {
            _id: {
              academicYear: "$academicYear",
              paymentDate: {
                $dateToString: { format: "%d-%m-%Y", date: "$paymentDate" },
              },
              cancelledDate: {
                $dateToString: { format: "%d-%m-%Y", date: "$cancelledDate" },
              },
              paymentMode: "$paymentMode",
              className: "$classData.className",
              sectionName: "$classData.sections.name",
              status: "$status",
              studentAdmissionNumber: "$admissionNumber",
              studentName: "$studentName",
              receiptNumber: "$receiptNumberBrf",
            },
            totalPaid: { $sum: "$amount" },
          },
        },
        {
          $addFields: {
            feeTypeId: "Board Registration Fees",
            installmentName: null,
            fineAmount: 0,
            excessAmount: 0,
          },
        },
      ]);

    // ----------------- Refund Fees -----------------
    const refundFeesAggregation = await RefundFees.aggregate([
      {
        $match: {
          schoolId: schoolIdString,
          refundDate: { $gte: startDate, $lte: endDate },
          status: "Paid",
          refundAmount: { $gt: 0 },
        },
      },
      {
        $lookup: {
          from: "classandsections",
          let: { classId: "$classId", academicYear: "$academicYear" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$classId"] },
                    { $eq: ["$academicYear", "$$academicYear"] },
                    { $eq: ["$schoolId", schoolIdString] },
                  ],
                },
              },
            },
          ],
          as: "classData",
        },
      },
      { $unwind: { path: "$classData", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          className: "$classData.className",
          sectionData: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$classData.sections",
                  as: "sec",
                  cond: { $eq: ["$$sec._id", "$sectionId"] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          sectionName: "$sectionData.name",
        },
      },
      {
        $facet: {
          withFeeTypeRefunds: [
            { $match: { feeTypeRefunds: { $ne: [] } } },
            { $unwind: "$feeTypeRefunds" },
            {
              $lookup: {
                from: "feestypes",
                localField: "feeTypeRefunds.feetype",
                foreignField: "_id",
                as: "feeTypeData",
              },
            },
            {
              $unwind: {
                path: "$feeTypeData",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $group: {
                _id: {
                  academicYear: "$academicYear",
                  refundDate: {
                    $dateToString: { format: "%d-%m-%Y", date: "$refundDate" },
                  },
                  paymentMode: "$paymentMode",
                  className: "$className",
                  sectionName: "$sectionName",
                  feeTypeId: "$feeTypeRefunds.feetype",
                  status: "$status",
                  studentAdmissionNumber: "$admissionNumber",
                  studentName: { $concat: ["$firstName", " ", "$lastName"] },
                  receiptNumber: "$receiptNumber",
                },
                totalRefund: { $sum: "$feeTypeRefunds.refundAmount" },
                fineAmount: { $sum: 0 },
                excessAmount: { $sum: 0 },
              },
            },
            {
              $addFields: {
                feeTypeId: {
                  $cond: [
                    { $eq: ["$feeTypeData", {}] },
                    "Unknown Refund",
                    "$feeTypeData._id",
                  ],
                },
                installmentName: null,
              },
            },
          ],
          withoutFeeTypeRefunds: [
            { $match: { feeTypeRefunds: { $eq: [] } } },
            {
              $group: {
                _id: {
                  academicYear: "$academicYear",
                  refundDate: {
                    $dateToString: { format: "%d-%m-%Y", date: "$refundDate" },
                  },
                  paymentMode: "$paymentMode",
                  className: "$className",
                  sectionName: "$sectionName",
                  feeTypeId: "$refundType",
                  status: "$status",
                  studentAdmissionNumber: "$admissionNumber",
                  studentName: { $concat: ["$firstName", " ", "$lastName"] },
                  receiptNumber: "$receiptNumber",
                },
                totalRefund: { $sum: "$refundAmount" },
                fineAmount: { $sum: 0 },
                excessAmount: { $sum: 0 },
              },
            },
            {
              $addFields: {
                feeTypeId: "$_id.feeTypeId",
                installmentName: null,
              },
            },
          ],
        },
      },
      {
        $project: {
          combined: {
            $concatArrays: ["$withFeeTypeRefunds", "$withoutFeeTypeRefunds"],
          },
        },
      },
      { $unwind: "$combined" },
      { $replaceRoot: { newRoot: "$combined" } },
    ]);

    // ----------------- Combine All -----------------
    const combinedData = [
      ...schoolFeesAggregation.map((item) => ({
        academicYear: item._id.academicYear,
        paymentDate: item._id.paymentDate,
        cancelledDate: item._id.cancelledDate || null,
        refundDate: null,
        paymentMode: item._id.paymentMode,
        feeTypeId: item._id.feeTypeId.toString(),
        feeTypeName:
          feeTypeMap[item._id.feeTypeId.toString()] || item._id.feeTypeId,
        className: item._id.className || null,
        sectionName: item._id.sectionName || null,
        installmentName: item._id.installmentName || null,
        totalPaid: item.totalPaid,
        fineAmount: item.fineAmount || 0,
        excessAmount: item.excessAmount || 0,
        status: item._id.status,
        studentAdmissionNumber: item._id.studentAdmissionNumber,
        studentName: item._id.studentName,
        receiptNumber: item._id.receiptNumber,
      })),
      ...admissionFeesAggregation.map((item) => ({
        academicYear: item._id.academicYear,
        paymentDate: item._id.paymentDate,
        cancelledDate: item._id.cancelledDate || null,
        refundDate: null,
        paymentMode: item._id.paymentMode,
        feeTypeId: item.feeTypeId,
        feeTypeName: feeTypeMap[item.feeTypeId] || item.feeTypeId,
        className: item._id.className || null,
        sectionName: item._id.sectionName || null,
        installmentName: item.installmentName,
        totalPaid: item.totalPaid,
        fineAmount: item.fineAmount || 0,
        excessAmount: item.excessAmount || 0,
        status: item._id.status,
        studentAdmissionNumber: item._id.studentAdmissionNumber,
        studentName: item._id.studentName,
        receiptNumber: item._id.receiptNumber,
      })),
      ...registrationFeesAggregation.map((item) => ({
        academicYear: item._id.academicYear,
        paymentDate: item._id.paymentDate,
        cancelledDate: item._id.cancelledDate || null,
        refundDate: null,
        paymentMode: item._id.paymentMode,
        feeTypeId: item.feeTypeId,
        feeTypeName: feeTypeMap[item.feeTypeId] || item.feeTypeId,
        className: item._id.className || null,
        sectionName: item._id.sectionName || null,
        installmentName: item.installmentName,
        totalPaid: item.totalPaid,
        fineAmount: item.fineAmount || 0,
        excessAmount: item.excessAmount || 0,
        status: item._id.status,
        studentAdmissionNumber: item._id.studentAdmissionNumber,
        studentName: item._id.studentName,
        receiptNumber: item._id.receiptNumber,
      })),
      ...tcFeesAggregation.map((item) => ({
        academicYear: item._id.academicYear,
        paymentDate: item._id.paymentDate,
        cancelledDate: item._id.cancelledDate || null,
        refundDate: null,
        paymentMode: item._id.paymentMode,
        feeTypeId: item.feeTypeId,
        feeTypeName: feeTypeMap[item.feeTypeId] || item.feeTypeId,
        className: item._id.className || null,
        sectionName: item._id.sectionName || null,
        installmentName: item.installmentName,
        totalPaid: item.totalPaid,
        fineAmount: item.fineAmount || 0,
        excessAmount: item.excessAmount || 0,
        status: item._id.status,
        studentAdmissionNumber: item._id.studentAdmissionNumber,
        studentName: item._id.studentName,
        receiptNumber: item._id.receiptNumber,
      })),
      ...boardExamFeesAggregation.map((item) => ({
        academicYear: item._id.academicYear,
        paymentDate: item._id.paymentDate,
        cancelledDate: item._id.cancelledDate || null,
        refundDate: null,
        paymentMode: item._id.paymentMode,
        feeTypeId: item.feeTypeId,
        feeTypeName: feeTypeMap[item.feeTypeId] || item.feeTypeId,
        className: item._id.className || null,
        sectionName: item._id.sectionName || null,
        installmentName: item.installmentName,
        totalPaid: item.totalPaid,
        fineAmount: item.fineAmount || 0,
        excessAmount: item.excessAmount || 0,
        status: item._id.status,
        studentAdmissionNumber: item._id.studentAdmissionNumber,
        studentName: item._id.studentName,
        receiptNumber: item._id.receiptNumber,
      })),
      ...boardRegistrationFeesAggregation.map((item) => ({
        academicYear: item._id.academicYear,
        paymentDate: item._id.paymentDate,
        cancelledDate: item._id.cancelledDate || null,
        refundDate: null,
        paymentMode: item._id.paymentMode,
        feeTypeId: item.feeTypeId,
        feeTypeName: feeTypeMap[item.feeTypeId] || item.feeTypeId,
        className: item._id.className || null,
        sectionName: item._id.sectionName || null,
        installmentName: item.installmentName,
        totalPaid: item.totalPaid,
        fineAmount: item.fineAmount || 0,
        excessAmount: item.excessAmount || 0,
        status: item._id.status,
        studentAdmissionNumber: item._id.studentAdmissionNumber,
        studentName: item._id.studentName,
        receiptNumber: item._id.receiptNumber,
      })),
      ...refundFeesAggregation.map((item) => ({
        academicYear: item._id.academicYear,
        paymentDate: item._id.refundDate,
        cancelledDate: null,
        refundDate: item._id.refundDate,
        paymentMode: item._id.paymentMode,
        feeTypeId: item._id.feeTypeId.toString(),
        feeTypeName:
          feeTypeMap[item._id.feeTypeId.toString()] || item._id.feeTypeId,
        className: item._id.className || null,
        sectionName: item._id.sectionName || null,
        installmentName: item.installmentName,
        totalPaid: -item.totalRefund,
        fineAmount: item.fineAmount || 0,
        excessAmount: item.excessAmount || 0,
        status: item._id.status,
        studentAdmissionNumber: item._id.studentAdmissionNumber,
        studentName: item._id.studentName,
        receiptNumber: item._id.receiptNumber,
      })),
    ];

    // ----------------- Group Final Data -----------------
    const groupedData = combinedData.reduce((acc, item) => {
      const key = `${item.academicYear}_${item.paymentDate || "none"}_${
        item.cancelledDate || "none"
      }_${item.paymentMode}_${item.installmentName || "none"}_${item.status}_${
        item.studentAdmissionNumber
      }_${item.receiptNumber}`;
      if (!acc[key]) {
        acc[key] = {
          academicYear: item.academicYear,
          paymentDate: item.paymentDate,
          cancelledDate: item.cancelledDate,
          refundDate: item.refundDate,
          paymentMode: item.paymentMode,
          feeTypes: {},
          className: item.className,
          sectionName: item.sectionName,
          installmentName: item.installmentName,
          fineAmount: item.fineAmount || 0,
          excessAmount: item.excessAmount || 0,
          status: item.status,
          studentAdmissionNumber: item.studentAdmissionNumber,
          studentName: item.studentName,
          receiptNumber: item.receiptNumber,
        };
      }
      acc[key].feeTypes[item.feeTypeName] =
        (acc[key].feeTypes[item.feeTypeName] || 0) + item.totalPaid;
      return acc;
    }, {});

    const result = Object.values(groupedData).sort((a, b) => {
      const dateA = new Date(
        (a.paymentDate || a.refundDate).split("-").reverse().join("-")
      );
      const dateB = new Date(
        (b.paymentDate || b.refundDate).split("-").reverse().join("-")
      );
      return dateA - dateB;
    });

    // ----------------- Build Filters -----------------
    const paymentModeOptions = [
      ...new Set(combinedData.map((item) => item.paymentMode).filter(Boolean)),
    ].map((mode) => ({
      value: mode,
      label: mode,
    }));

    const feeTypeOptions = [
      ...new Set(combinedData.map((item) => item.feeTypeName)),
    ].map((type) => ({
      value: type,
      label: type,
    }));

    const uniqueFeeTypes = [
      ...new Set(combinedData.map((item) => item.feeTypeName)),
    ].sort();

    res.status(200).json({
      data: result,
      feeTypes: uniqueFeeTypes,
      filterOptions: {
        classOptions,
        sectionOptions,
        installmentOptions,
        feeTypeOptions,
        paymentModeOptions,
        academicYearOptions,
      },
    });
  } catch (error) {
    console.error("Error fetching total paid fee types:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export default getTotalPaidFeeTypes;
