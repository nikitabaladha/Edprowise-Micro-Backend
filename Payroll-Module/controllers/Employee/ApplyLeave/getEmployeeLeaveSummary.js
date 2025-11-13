import EmployeeLeave from "../../../models/Employee/EmployeeLeave.js";
import SchoolAnnualLeaveTypes from "../../../models/AdminSettings/SchoolAnnualLeaveTypes.js";
import SchoolCarryForwardConditions from "../../../models/AdminSettings/SchoolAnnualLeaveCarryForwardRule.js";

const getEmployeeLeaveSummary = async (req, res) => {
  try {
    const { schoolId, employeeId, academicYear } = req.params;

    const record = await EmployeeLeave.findOne({ schoolId, employeeId });

    if (!record || !record.leaveRecords) {
      return res.status(200).json({ hasError: false, data: {} });
    }

    // Step 1: Fetch leave records for current academic year
    const currentYearRecords = record.leaveRecords.get(academicYear) || [];

    // Step 2: Build availed and pending leave counts by leaveType
    const leaveUsage = {}; // temp summary to store counts
    for (const leave of currentYearRecords) {
      const type = leave.leaveType;

      if (!leaveUsage[type]) {
        leaveUsage[type] = {
          availedLeave: 0,
          pendingApproval: 0,
        };
      }

      if (leave.status === "approved") {
        leaveUsage[type].availedLeave += leave.numberOfDays;
      } else if (leave.status === "pending") {
        leaveUsage[type].pendingApproval += leave.numberOfDays;
      }
    }

    // Step 3: Fetch current academic year leave types (entitled days)
    const leaveTypes = await SchoolAnnualLeaveTypes.find({
      schoolId,
      academicYear,
    });

    // Step 4: Read carry forward from previous academic year
    const carryForwardMap = record.carryForwardDays?.get(academicYear) || {};

    // Step 5: Fetch carry forward rules
    const carryRules = await SchoolCarryForwardConditions.find({
      schoolId,
      academicYear,
    });
    const ruleMap = {};
    for (const rule of carryRules) {
      ruleMap[String(rule.leaveTypeId)] = rule.mandatoryExpiredLeaves || 0;
    }

    // Step 5: Combine all into a final summary per leave type
    const finalSummary = {};

    for (const type of leaveTypes) {
      const name = type.annualLeaveTypeName;
      const entitled = type.days;

      const availed = leaveUsage[name]?.availedLeave || 0;
      const pending = leaveUsage[name]?.pendingApproval || 0;
      const carry = carryForwardMap[name] || 0;

      let mandatoryExpiredLeaves = 0;
      if (type.isCarryForward) {
        mandatoryExpiredLeaves = ruleMap[String(type._id)] || 0;
      }

      finalSummary[name] = {
        entitledLeave: entitled,
        availedLeave: availed,
        pendingApproval: pending,
        carryForward: carry,
        balanceLeave: entitled + carry - availed,
        mandatoryExpiredLeaves,
      };
    }
    console.log("Final Summary:", finalSummary);
    return res.status(200).json({
      hasError: false,
      data: finalSummary,
    });
  } catch (err) {
    console.error("Error fetching employee leave summary:", err);
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
};

export default getEmployeeLeaveSummary;
