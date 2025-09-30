import ContraEntry from "../../../models/Contra.js";
import mongoose from "mongoose";

async function updateById(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schoolId = req.user?.schoolId;
    const { id, academicYear } = req.params;

    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const { approvalStatus, reasonOfDisapprove } = req.body;

    // Validate schoolId
    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    // Validate required fields
    if (!id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Contra Entry ID is required.",
      });
    }

    if (!approvalStatus) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Approval status is required.",
      });
    }

    // Validate approvalStatus value
    if (!["Approved", "Disapproved", "Pending"].includes(approvalStatus)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Approval status must be either 'Approved' or 'Disapproved'.",
      });
    }

    // Validate reasonOfDisapprove for Disapproved status
    if (approvalStatus === "Disapproved" && !reasonOfDisapprove) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message:
          "Reason of disapproval is required when status is 'Disapproved'.",
      });
    }

    // Validate reasonOfDisapprove length if provided
    if (reasonOfDisapprove && reasonOfDisapprove.length > 500) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Reason of disapproval must not exceed 500 characters.",
      });
    }

    // Find the existing contra entry
    const existingContraEntry = await ContraEntry.findOne({
      _id: id,
      schoolId,
      academicYear,
    }).session(session);

    if (!existingContraEntry) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "Contra Entry not found.",
      });
    }

    // Prepare update data
    const updateData = {
      approvalStatus,
    };

    // Handle reasonOfDisapprove based on approval status
    if (approvalStatus === "Approved") {
      updateData.reasonOfDisapprove = ""; // Clear the reason when approved
    } else if (approvalStatus === "Disapproved") {
      updateData.reasonOfDisapprove = reasonOfDisapprove;
    }

    // Update the contra entry
    const updatedContraEntry = await ContraEntry.findOneAndUpdate(
      {
        _id: id,
        schoolId,
      },
      updateData,
      {
        new: true,
        runValidators: true,
        session,
      }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: `Contra Entry ${
        approvalStatus === "Approved" ? "approved" : "disapproved"
      } successfully!`,
      data: updatedContraEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error updating Contra Entry approval status:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        hasError: true,
        message: `Validation error: ${errors.join(", ")}`,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        hasError: true,
        message: "Invalid Contra Entry ID.",
      });
    }

    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
