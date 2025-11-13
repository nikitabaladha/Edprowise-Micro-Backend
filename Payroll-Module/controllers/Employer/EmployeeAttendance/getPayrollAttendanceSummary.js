import moment from "moment";
import EmployeeAttendance from "../../../models/Employee/EmployeeAttendance.js";
import EmployeeLeave from "../../../models/Employee/EmployeeLeave.js";
import SchoolAnnualLeaveTypes from "../../../models/AdminSettings/SchoolAnnualLeaveTypes.js";
import EmployeeRegistration from "../../../models/Employer/EmployeeRegistration.js";
import EmployeeCTC from "../../../models/Employer/EmployeeCTC.js";
import PfDepositedRegister from "../../../models/Employer/PfDepositedRegister.js";
import EsiRegister from "../../../models/Employer/EsiRegister.js";
import PfEsiSetting from "../../../models/AdminSettings/PfEsiSetting.js";

const getPayrollAttendanceSummary = async (req, res) => {
  try {
    const { schoolId, year, month, academicYear } = req.query;

    if (!schoolId || !year || !month || !academicYear) {
      return res
        .status(400)
        .json({ hasError: true, message: "Missing parameters" });
    }

    const monthNum = parseInt(month);
    const monthKey = `${year}-${String(monthNum).padStart(2, "0")}`;
    const startDate = moment(`${year}-${monthNum}-01`, "YYYY-MM-DD");
    const endDate = startDate.clone().endOf("month");
    const daysInMonth = endDate.date();
    const monthName = moment(month, "MM").format("MMMM");

    // Fetch PF/ESI Settings
    const setting = await PfEsiSetting.findOne({
      schoolId,
      academicYear,
    }).lean();
    const pfEnabled = setting?.pfEnabled ?? false;
    const esiEnabled = setting?.esiEnabled ?? false;

    // Fetch data
    const employees = await EmployeeRegistration.find({
      schoolId,
      academicYearDetails: { $exists: true },
    }).lean();
    const leaveEntitlements = await SchoolAnnualLeaveTypes.find({
      schoolId,
      academicYear,
    }).lean();
    const attendanceRecords = await EmployeeAttendance.find({
      schoolId,
    }).lean();
    const leaveRecords = await EmployeeLeave.find({ schoolId }).lean();
    const ctcRecords = await EmployeeCTC.find({
      schoolId,
      academicYear,
    }).lean();

    // PF Register
    const pfRegisters = pfEnabled
      ? await PfDepositedRegister.find({
          schoolId,
          academicYear,
          year,
          month: monthName,
        }).lean()
      : [];
    const pfDeductionMap = {};
    pfRegisters.forEach((entry) => {
      pfDeductionMap[entry.employeeId] = entry;
    });

    // ESI Register
    const esiRegisters = esiEnabled
      ? await EsiRegister.findOne({
          schoolId,
          academicYear,
          year,
          month: monthName,
        }).lean()
      : null;
    const esiDeductionMap = {};
    esiRegisters?.data?.forEach((entry) => {
      esiDeductionMap[entry.employeeId] = entry;
    });

    // Leave Entitlement Map
    const leaveMap = {};
    leaveEntitlements.forEach((lt) => {
      leaveMap[lt.annualLeaveTypeName] = lt.days;
    });

    // Carry forward map per employee
    const carryForwardMapByEmp = {};
    for (const leave of leaveRecords) {
      const empId = leave.employeeId;
      const carryMap = leave.carryForwardDays?.[academicYear] || {};
      carryForwardMapByEmp[empId] = carryMap;
    }

    const data = [];

    for (const emp of employees) {
      const empId = emp.employeeId;

      const academicDetail = emp.academicYearDetails?.find(
        (detail) => detail.academicYear === academicYear
      );
      const grade = academicDetail?.grade || "-";
      const jobDesignation = academicDetail?.jobDesignation || "-";
      const categoryOfEmployees = academicDetail?.categoryOfEmployees || "-";

      const attnDoc = attendanceRecords.find((e) => e.employeeId === empId);
      const attendance = attnDoc?.attendance?.[monthKey] || [];

      let holidays = 0;
      let presentDays = 0;

      attendance.forEach((entry) => {
        if (entry.dateStatus === "weekend" || entry.dateStatus === "holiday")
          holidays++;
        else if (entry.dateStatus === "present") presentDays++;
      });

      const empLeaveDoc = leaveRecords.find((l) => l.employeeId === empId);
      const empLeaves = empLeaveDoc?.leaveRecords?.[academicYear] || [];

      let regularizedLeave = 0;
      let unpaidLeave = 0;

      const selectedMonthStart = moment(
        `${year}-${String(monthNum).padStart(2, "0")}-01`
      );
      const selectedMonthEnd = selectedMonthStart.clone().endOf("month");

      const leaveTypeMonthMap = {};

      for (const leave of empLeaves) {
        const leaveStart = moment(leave.fromDate);
        const leaveEnd = moment(leave.toDate);
        const leaveStatus = leave.status;
        const leaveType = leave.leaveType;

        if (leaveStatus !== "approved") continue;

        const overlapStart = moment.max(leaveStart, selectedMonthStart);
        const overlapEnd = moment.min(leaveEnd, selectedMonthEnd);

        if (overlapStart.isAfter(overlapEnd)) continue;

        const daysInMonth = overlapEnd.diff(overlapStart, "days") + 1;

        if (!leaveTypeMonthMap[leaveType]) leaveTypeMonthMap[leaveType] = 0;
        leaveTypeMonthMap[leaveType] += daysInMonth;
      }

      const carryMap = carryForwardMapByEmp[empId] || {};

      for (const [leaveType, availed] of Object.entries(leaveTypeMonthMap)) {
        const entitled = leaveMap[leaveType] || 0;
        const carry = carryMap[leaveType] || 0;
        const balance = entitled + carry;

        if (availed <= balance) {
          regularizedLeave += availed;
        } else {
          regularizedLeave += balance;
          unpaidLeave += availed - balance;
        }
      }

      const workingDays = daysInMonth - holidays;
      const workedDays = presentDays;
      const paidDays = workedDays + regularizedLeave;

      const employeeCTC = ctcRecords.find((c) => c.employeeId === empId);
      const currentMonthEnd = new Date(parseInt(year), monthNum, 0);
      let ctcToUse = null;

      if (employeeCTC) {
        const applicableDate = new Date(employeeCTC.applicableDate);
        if (applicableDate <= currentMonthEnd) {
          ctcToUse = employeeCTC;
        } else {
          const validHistory = employeeCTC.history
            .filter((h) => new Date(h.applicableDate) <= currentMonthEnd)
            .sort(
              (a, b) => new Date(b.applicableDate) - new Date(a.applicableDate)
            );
          if (validHistory.length > 0) {
            ctcToUse = validHistory[0];
          }
        }
      }

      const componentEarnings = {};
      let grossEarning = 0;

      if (ctcToUse && ctcToUse.components) {
        ctcToUse.components.forEach((comp) => {
          const value =
            workingDays > 0
              ? (comp.annualAmount / 12 / workingDays) * paidDays
              : 0;
          const val = parseFloat(value.toFixed(2));
          componentEarnings[comp.ctcComponentName] = val;
          grossEarning += val;
        });
      }

      // PF Deduction
      const pfDeduction = pfEnabled
        ? {
            employeePFDeduction:
              pfDeductionMap[empId]?.deduction?.employeePFDeduction || 0,
            voluntaryPF: pfDeductionMap[empId]?.deduction?.voluntaryPF || 0,
          }
        : null;

      // ESI Deduction
      const esiDeduction =
        esiEnabled && grossEarning <= 21000
          ? {
              employeeESIDeduction:
                esiDeductionMap[empId]?.deduction?.employeeESIDeduction || 0,
              employerESIContribution:
                esiDeductionMap[empId]?.deduction?.employerESIContribution || 0,
            }
          : null;

      data.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        grade,
        jobDesignation,
        categoryOfEmployees,
        daysInMonth,
        holiday: holidays,
        workingDays,
        workedDays,
        regularizedLeave,
        paidDays,
        unpaidLeave,
        pfDeduction,
        esiDeduction,
        ctc: {
          components: ctcToUse?.components || [],
          totalAnnualCost: ctcToUse?.totalAnnualCost || 0,
          componentEarnings: { earnings: componentEarnings },
        },
      });
    }

    console.log("Returning payroll data:", JSON.stringify(data, null, 2)); // Debug response
    return res.status(200).json({ hasError: false, data });
  } catch (err) {
    console.error("Payroll Attendance Summary Error:", err);
    return res
      .status(500)
      .json({ hasError: true, message: "Internal Server Error" });
  }
};

export default getPayrollAttendanceSummary;
