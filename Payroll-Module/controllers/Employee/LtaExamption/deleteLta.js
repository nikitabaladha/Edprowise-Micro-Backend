import mongoose from "mongoose";
import EmployeeltaDetails from "../../../models/Employee/EmployeeltaDetails.js";
import fs from "fs";
import path from "path";

const deleteLta = async (req, res) => {
  try {
    const { detailId } = req.params;
    const employeeId = req.query.employeeId;
    console.log("detailId", detailId);
    console.log("employeeId", employeeId);

    console.log("req.params:", req.params);
    console.log("req.query:", req.query);
    console.log("req.body:", req.body);

    // Validate parameters
    if (!employeeId || !detailId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and Detail ID are required",
      });
    }

    // Validate detailId is a valid ObjectId
    if (!mongoose.isValidObjectId(detailId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Detail ID format",
      });
    }

    const record = await EmployeeltaDetails.findOne({
      employeeId: employeeId,
      "ltaDetails._id": detailId,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "LTA detail not found",
      });
    }

    const detail = record.ltaDetails.find((d) => d._id.toString() === detailId);

    // Delete the file from the filesystem if it exists
    if (detail.billFile && fs.existsSync(detail.billFile)) {
      try {
        fs.unlinkSync(detail.billFile);
      } catch (fileError) {
        console.error("Error deleting file:", fileError);
      }
    }

    record.ltaDetails = record.ltaDetails.filter(
      (detail) => detail._id.toString() !== detailId
    );

    if (record.ltaDetails.length === 0) {
      await EmployeeltaDetails.deleteOne({ _id: record._id });
      return res.status(200).json({
        success: true,
        message: "LTA record deleted as no details remain",
      });
    }

    //  record.proofSubmitted = record.ltaDetails.length;
    record.proofSubmitted = record.ltaDetails.reduce(
      (sum, detail) => sum + detail.totalAmount,
      0
    );

    await record.save();

    return res.status(200).json({
      success: true,
      message: "LTA detail deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting LTA detail:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete LTA detail",
    });
  }
};

export default deleteLta;
