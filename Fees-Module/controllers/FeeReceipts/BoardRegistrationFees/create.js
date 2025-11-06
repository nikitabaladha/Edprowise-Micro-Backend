import RegistrationFeePayment from "../../../models/BoardRegistrationFeePayment.js";
import { BoardRegistrationFeePaymentValidator } from "../../../validators/BoardRegistrationFeesPayment.js";

// ==========Nikita's Code Start=======
import { addInReceiptForFees } from "../../AxiosRequestService/AddInReceiptForFees.js";

function normalizeDateToUTCStartOfDay(date) {
  const newDate = new Date(date);
  // Convert to UTC start of day (00:00:00.000Z)
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

// ==========Nikita's Code End=======

export const submitRegistrationFees = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to submit registration fees.",
      });
    }

    const { error } = BoardRegistrationFeePaymentValidator.validate(req.body);
    if (error) {
      return res.status(400).json({
        hasError: true,
        message: error.details[0].message,
      });
    }

    const { payments } = req.body;

    const existingPayments = await RegistrationFeePayment.find({
      schoolId,
      academicYear: payments[0].academicYear,
      admissionId: { $in: payments.map((p) => p.studentId) },
    });

    // if (existingPayments.length > 0) {
    //   return res.status(409).json({
    //     hasError: true,
    //     message: "Some payments already exist for the given students in this academic year.",
    //   });
    // }

    const createdPayments = [];

    for (const payment of payments) {
      const paymentDoc = new RegistrationFeePayment({
        schoolId: schoolId,
        academicYear: payment.academicYear,
        admissionId: payment.studentId,
        admissionNumber: payment.admissionNumber,
        firstName: payment.firstName,
        lastName: payment.lastName,
        classId: payment.classId,
        sectionId: payment.sectionId,
        className: payment.className,
        sectionName: payment.sectionName,
        finalAmount: payment.finalAmount,
        paymentMode: payment.paymentMode,
        chequeNumber: payment.chequeNumber || "",
        bankName: payment.bankName || "",
        status: payment.status,
        paymentDate:
          payment.status === "Paid" ? payment.paymentDate : new Date(),
      });

      const saved = await paymentDoc.save();
      createdPayments.push(saved);

      // ==========Nikita's Code Start=======
      // Call the finance module to store the payment in Receipt And Opening Closing Balance
      if (payment.paymentMode !== "null" && payment.status === "Paid") {
        try {
          const financeData = {
            paymentId: saved._id.toString(),
            finalAmount: parseFloat(payment.finalAmount),
            paymentDate:
              normalizeDateToUTCStartOfDay(saved.paymentDate) || new Date(),
            academicYear: payment.academicYear,
            paymentMode: payment.paymentMode,
            feeType: "Board Registration", // ADD THIS - Important!
          };

          await addInReceiptForFees(
            schoolId,
            payment.academicYear,
            financeData
          );

          console.log(
            "===========Payment added to Receipt successfully==============="
          );
        } catch (financeError) {
          console.error("Failed to add payment to Receipt:", financeError);
          // Don't fail the main payment if receipt creation fails
        }
      }

      // ==========Nikita's Code End=======
    }

    return res.status(201).json({
      hasError: false,
      message: "Registration fee payments submitted successfully.",
      data: createdPayments,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({
      hasError: true,
      message: "Server error while submitting registration fee payments.",
    });
  }
};

export default submitRegistrationFees;
