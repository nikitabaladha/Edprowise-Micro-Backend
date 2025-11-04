import mongoose from "mongoose";
import { SchoolFees, SchoolFeesCounter } from "../../../models/SchoolFees.js";

const getNextReceiptNumber = async (schoolId, session) => {
  const counter = await SchoolFeesCounter.findOneAndUpdate(
    { schoolId },
    { $inc: { receiptSeq: 1 } },
    { new: true, upsert: true, session }
  );
  return `REC-${counter.receiptSeq.toString().padStart(5, "0")}`;
};

const schoolFees = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      await session.abortTransaction();
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID missing.",
      });
    }

    const {
      studentAdmissionNumber,
      studentName,
      className,
      section,
      transactionNumber,
      paymentMode,
      collectorName,
      academicYear,
      installments,
    } = req.body;

    if (!Array.isArray(installments) || installments.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        hasError: true,
        message: "Installments data is required and must be a non-empty array.",
      });
    }

    const existingRecord = await SchoolFees.findOne({
      schoolId,
      studentAdmissionNumber,
      academicYear,
    }).session(session);

    const newReceiptNumber = await getNextReceiptNumber(schoolId, session);

    if (existingRecord) {
      // ✅ Only update receipt number
      existingRecord.receiptNumber = newReceiptNumber;
      await existingRecord.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        hasError: false,
        message: "Existing record found. Receipt number updated.",
        receipt: existingRecord,
      });
    } else {
      // Create new record if not found
      const processedInstallments = installments.map((inst, index) => ({
        ...inst,
        number: inst.number ?? index + 1,
      }));

      const newSchoolFees = new SchoolFees({
        schoolId,
        studentAdmissionNumber,
        studentName,
        className,
        section,
        receiptNumber: newReceiptNumber,
        transactionNumber,
        paymentMode,
        collectorName,
        academicYear,
        installments: processedInstallments,
      });

      await newSchoolFees.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        hasError: false,
        message: "New school fee record created.",
        receipt: newSchoolFees,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error in school fee API:", error);
    res.status(500).json({
      hasError: true,
      message: "Error processing school fee data",
      error: error.message,
    });
  }
};

export default schoolFees;
