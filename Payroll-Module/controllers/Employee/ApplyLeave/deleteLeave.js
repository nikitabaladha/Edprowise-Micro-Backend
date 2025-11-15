import EmployeeLeave from "../../../models/Employee/EmployeeLeave.js";
import EmployeeAttendance from "../../../models/Employee/EmployeeAttendance.js";

const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params; // Get leave ID from URL
    const { academicYear } = req.query; // Get academicYear from query parameter

    if (!id) {
      return res
        .status(400)
        .json({ hasError: true, message: "Leave ID is required" });
    }

    // Default to current academic year if not provided (e.g., 2025-26)
    const currentYear = new Date().getFullYear();
    const defaultAcademicYear = `${currentYear}-${(currentYear + 1)
      .toString()
      .slice(-2)}`;
    const effectiveAcademicYear = academicYear || defaultAcademicYear;

    // Find the document that contains the leave record with the given ID
    const doc = await EmployeeLeave.findOne({
      [`leaveRecords.${effectiveAcademicYear}._id`]: id,
      schoolId: req.user.schoolId, // Assuming authentication middleware provides user
      employeeId: req.user.userId, // Verify employeeId matches
    });

    if (!doc) {
      return res.status(404).json({
        hasError: true,
        message: "Leave entry not found or unauthorized",
      });
    }

    const { employeeId, schoolId } = doc;
    const leaveRecords = doc.leaveRecords[effectiveAcademicYear] || [];
    const leaveToDelete = leaveRecords.find(
      (leave) => leave._id.toString() === id
    );

    if (!leaveToDelete) {
      return res.status(404).json({
        hasError: true,
        message: "Leave not found in academic year records",
      });
    }

    const { fromDate, toDate } = leaveToDelete;

    // Step 1: Remove the leave from EmployeeLeave collection
    await EmployeeLeave.updateOne(
      { employeeId, schoolId },
      {
        $pull: {
          [`leaveRecords.${effectiveAcademicYear}`]: { _id: id },
        },
      }
    );

    // Step 2: Prepare date list between fromDate and toDate
    const dateList = [];
    let current = new Date(fromDate);
    const end = new Date(toDate);
    while (current <= end) {
      dateList.push(current.toISOString().split("T")[0]); // format: YYYY-MM-DD
      current.setDate(current.getDate() + 1);
    }

    // Step 3: Group dates by month-year for attendance deletion
    const mmYYYYMap = new Map();
    for (const date of dateList) {
      const [year, month] = date.split("-");
      const mmYYYY = `${month}-${year}`;
      if (!mmYYYYMap.has(mmYYYY)) {
        mmYYYYMap.set(mmYYYY, []);
      }
      mmYYYYMap.get(mmYYYY).push(date);
    }

    // Step 4: Remove corresponding attendance entries
    for (const [mmYYYY, dates] of mmYYYYMap.entries()) {
      const unsetFields = {};
      dates.forEach((date) => {
        unsetFields[`attendance.${date}`] = "";
      });

      await EmployeeAttendance.updateOne(
        { employeeId, schoolId, monthYear: mmYYYY },
        { $unset: unsetFields }
      );
    }

    return res.status(200).json({
      hasError: false,
      message: "Leave and attendance data deleted successfully",
    });
  } catch (error) {
    console.error("Delete Leave Error:", error);
    return res
      .status(500)
      .json({ hasError: true, message: "Internal server error" });
  }
};

export default deleteLeave;
