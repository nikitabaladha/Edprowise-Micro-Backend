import ClassAndSection from "../../../models/Class&Section.js";
import { TCPayment } from "../../../models/TCForm.js";
import Refund from "../../../models/RefundFees.js";
import FeesManagementYear from "../../../models/FeesManagementYear.js";

export const getAllTCFees = async (req, res) => {
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
    const targetAcademicYear = academicYear;

    const paymentDataList = await TCPayment.find({
      schoolId,
      paymentDate: { $gte: startDate, $lte: endDate },
      paymentMode: { $ne: "null" },
      status: { $ne: "Pending" },
    })
      .populate("tcFormId")
      .lean();

    if (!paymentDataList.length) {
      return res.status(404).json({
        message: `No TC payment data found for academic year ${targetAcademicYear}`,
      });
    }

    const combinedDetails = [];
    const receiptNumbers = [];

    for (const payment of paymentDataList) {
      const tcForm = payment.tcFormId;
      if (!tcForm) {
        console.warn(`TCForm not found for payment with ID ${payment._id}`);
        continue;
      }

      const classId = tcForm.masterDefineClass || null;
      const sectionId = tcForm.section || null;
      let className = "-";

      if (classId && sectionId) {
        const classData = await ClassAndSection.findOne({
          schoolId,
          // academicYear: targetAcademicYear,
          "sections._id": sectionId,
        }).lean();
        if (classData) {
          className = classData.className || "-";
        }
      } else if (classId) {
        const classData = await ClassAndSection.findOne({
          schoolId,
          // academicYear: targetAcademicYear,
          _id: classId,
        }).lean();
        className = classData?.className || "-";
      }

      const paymentDetail = {
        recordType: "Transfer Certificate",
        paymentId: payment._id.toString(),
        tcFormId: payment.tcFormId._id.toString(),
        firstName: tcForm.firstName || "-",
        lastName: tcForm.lastName || "-",
        admissionNumber: tcForm.AdmissionNumber || "-",
        academicYear: tcForm.academicYear,
        tcNo: tcForm.certificateNumber,
        className,
        tcFeesDate: payment.paymentDate
          ? new Date(payment.paymentDate)
              .toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
              .replace(/\//g, "-")
          : "-",
        tcFeesCancelledDate: payment.cancelledDate
          ? new Date(payment.cancelledDate)
              .toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
              .replace(/\//g, "-")
          : "-",
        tcFeesPaymentMode: payment.paymentMode || "-",
        tcFeesDue: payment.TCfees?.toString() || "0",
        tcFeesConcession: payment.concessionAmount?.toString() || "0",
        tcFeesPaid: payment.finalAmount?.toString() || "0",
        tcFeesChequeNumber: payment.chequeNumber || "-",
        tcFeesBankName: payment.bankName || "-",
        tcFeesTransactionNo:
          payment.chequeNumber || payment.transactionNumber || "-",
        tcFeesReceiptNo: payment.receiptNumber || "-",
        tcFeesStatus: payment.status || "-",
        tcFeesRefundAmount: "0",
        tcFeesCancelledAmount: "0",
      };

      combinedDetails.push(paymentDetail);
      if (payment.receiptNumber) {
        receiptNumbers.push(payment.receiptNumber);
      }
    }

    if (receiptNumbers.length > 0) {
      const refunds = await Refund.find({
        schoolId,
        refundType: "Transfer Certificate Fee",
        $or: [
          {
            $and: [
              { status: "Refund" },
              { refundDate: { $gte: startDate, $lte: endDate } },
            ],
          },
          {
            $and: [
              { status: { $in: ["Cancelled", "Cheque Return"] } },
              { cancelledDate: { $gte: startDate, $lte: endDate } },
            ],
          },
        ],

        existancereceiptNumber: { $in: receiptNumbers },
      }).lean();

      const refundDetails = await Promise.all(
        refunds.map(async (refund) => {
          let className = "-";
          if (refund.classId) {
            const classData = await ClassAndSection.findOne({
              schoolId,
              // academicYear: targetAcademicYear,
              _id: refund.classId,
            }).lean();
            className = classData?.className || "-";
          }

          return {
            recordType: "Refund",
            tcFeesDate:
              refund.status === "Refund" && refund.refundDate
                ? new Date(refund.refundDate)
                    .toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                    .replace(/\//g, "-")
                : refund.cancelledDate
                ? new Date(refund.cancelledDate)
                    .toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                    .replace(/\//g, "-")
                : "-",
            academicYear: refund.academicYear || "-",
            admissionNumber: refund.admissionNumber || "-",
            firstName: refund.firstName || "-",
            lastName: refund.lastName || "-",
            className,
            tcFeesStatus: refund.status || "-",
            tcFeesPaymentMode: refund.paymentMode || "-",
            tcFeesReceiptNo: refund.receiptNumber || "-",
            tcFeesDue:
              -(refund.paidAmount + refund.concessionAmount)?.toString() || "0",
            tcFeesConcession: -refund.concessionAmount?.toString() || "0",
            // tcFeesPaid: refund.paidAmount?.toString() || '0',
            tcFeesRefundAmount:
              refund.refundAmount > 0
                ? -refund.refundAmount.toString()
                : -refund.cancelledAmount?.toString() || "0",
            tcFeesCancelledAmount: refund.cancelledAmount?.toString() || "0",
            tcFeesChequeNumber: refund.chequeNumber || "-",
            tcFeesBankName: refund.bankName || "-",
            tcFeesTransactionNo: refund.transactionNumber || "-",
            // tcFeesConcession: '0',
          };
        })
      );

      combinedDetails.push(...refundDetails);
    }

    const paymentCounts = combinedDetails.reduce((acc, detail) => {
      const admissionNo = detail.admissionNumber;
      acc[admissionNo] = (acc[admissionNo] || 0) + 1;
      return acc;
    }, {});
    console.log("Payment entries per admission number:", paymentCounts);

    res.status(200).json({
      combinedDetails,
      paymentCount: paymentDataList.length,
    });
  } catch (error) {
    console.error("Error fetching TC fees data:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export default getAllTCFees;
