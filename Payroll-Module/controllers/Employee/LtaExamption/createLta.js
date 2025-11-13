import mongoose from "mongoose";
import EmployeeltaDetails from "../../../models/Employee/EmployeeltaDetails.js";
import ItDeclaration from "../../../models/Employee/ItDeclaration.js";
import fs from "fs";

const createLta = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { employeeId } = req.params;
    const {
      employeeName,
      billNumber,
      billDate,
      itemPurchased,
      vendorName,
      gstNumber,
      grossAmount,
      gstCharge,
      totalAmount,
      status,
      schoolId,
      academicYear,
      categoryLimit,
    } = req.body;

    // Validate required fields
    if (
      !employeeId ||
      !schoolId ||
      !academicYear ||
      !employeeName ||
      !billNumber ||
      !billDate ||
      !itemPurchased ||
      !vendorName ||
      !gstNumber ||
      !grossAmount ||
      !gstCharge ||
      !totalAmount
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    // Validate GST number format
    const gstRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(gstNumber)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid GST Number format",
      });
    }

    // Validate amounts
    const grossAmt = parseFloat(grossAmount);
    const gstAmt = parseFloat(gstCharge);
    const totalAmt = parseFloat(totalAmount);
    if (grossAmt <= 0 || gstAmt < 0 || totalAmt <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Amounts must be positive numbers",
      });
    }

    // Validate billDate
    const selectedDate = new Date(billDate);
    const today = new Date();
    if (selectedDate > today) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Bill date cannot be in the future",
      });
    }

    // Prepare LTA detail
    const ltaDetail = {
      NameOnBill: employeeName,
      billNumber,
      billDate: selectedDate,
      itemPurchased,
      vendorName,
      gstNumber,
      grossAmount: grossAmt,
      gstCharge: gstAmt,
      totalAmount: totalAmt,
      billstatus: status || "Pending",
      billFile: req.files?.[0]?.path,
      createdAt: new Date(),
    };

    // Find or create the LTA record
    let ltaRecord = await EmployeeltaDetails.findOne(
      { schoolId, employeeId, academicYear },
      null,
      { session }
    );

    if (ltaRecord) {
      ltaRecord.ltaDetails.push(ltaDetail);
      // Calculate proofSubmitted as sum of totalAmount in ltaDetails
      ltaRecord.proofSubmitted = ltaRecord.ltaDetails.reduce(
        (sum, detail) => sum + detail.totalAmount,
        0
      );
      // Calculate categoryFinalDeduction as minimum of categoryLimit and proofSubmitted
      ltaRecord.categoryFinalDeduction = Math.min(
        ltaRecord.proofSubmitted,
        categoryLimit || ltaRecord.categoryLimit || 0
      );
      await ltaRecord.save({ session });
    } else {
      const proofSubmitted = totalAmt;
      const categoryFinalDeduction = Math.min(
        proofSubmitted,
        categoryLimit || 0
      );
      ltaRecord = new EmployeeltaDetails({
        schoolId,
        employeeId,
        academicYear,
        categoryLimit,
        ltaDetails: [ltaDetail],
        proofSubmitted,
        categoryFinalDeduction,
        status: "Pending",
      });
      await ltaRecord.save({ session });
    }

    let itDeclaration = await ItDeclaration.findOne(
      { schoolId, employeeId, academicYear },
      null,
      { session }
    );

    if (!itDeclaration) {
      itDeclaration = new ItDeclaration({
        schoolId,
        employeeId,
        otherExemption: {
          ltaExemption: {
            ltaDetailsId: ltaRecord._id,
            status: "Pending",
          },
        },
      });
    } else {
      itDeclaration.otherExemption.ltaExemption.ltaDetailsId = ltaRecord._id;
      itDeclaration.otherExemption.ltaExemption.status =
        ltaRecord.status || "Pending";
    }

    await itDeclaration.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "LTA detail added and IT Declaration updated successfully",
      data: ltaRecord,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating LTA detail:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create LTA detail",
    });
  }
};

export default createLta;
