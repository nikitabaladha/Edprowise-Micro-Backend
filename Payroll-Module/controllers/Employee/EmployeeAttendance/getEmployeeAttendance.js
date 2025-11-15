import EmployeeAttendance from "../../../models/Employee/EmployeeAttendance.js";
import SchoolHoliday from "../../../models/AdminSettings/SchoolHoliday.js";
import moment from "moment";

const getEmployeeAttendance = async (req, res) => {
  const { schoolId, employeeId } = req.params;

  if (!schoolId || !employeeId) {
    return res
      .status(400)
      .json({ hasError: true, message: "Missing parameters" });
  }

  try {
    let attendanceRecord = await EmployeeAttendance.findOne({
      schoolId,
      employeeId,
    });

    if (!attendanceRecord) {
      attendanceRecord = new EmployeeAttendance({
        schoolId,
        employeeId,
        attendance: {},
      });
    }

    const currentYear = moment().year();

    const holidays = await SchoolHoliday.find({ schoolId }).lean();

    const groupedHolidays = {}; // { "YYYY-MM": [ { date, holidayName }, ... ] }
    holidays.forEach((h) => {
      const date = moment(h.date).format("YYYY-MM-DD");
      const key = moment(h.date).format("YYYY-MM");
      if (!groupedHolidays[key]) groupedHolidays[key] = [];
      groupedHolidays[key].push({ date, holidayName: h.holidayName });
    });

    let isModified = false;

    for (const [monthKey, monthHolidays] of Object.entries(groupedHolidays)) {
      const existingMonth = attendanceRecord.attendance.get(monthKey) || [];

      const existingHolidayDates = new Set(
        existingMonth
          .filter((entry) => entry.dateStatus === "holiday")
          .map((entry) => entry.date)
      );

      const newHolidays = monthHolidays
        .filter((h) => !existingHolidayDates.has(h.date))
        .map((h) => ({
          date: h.date,
          dateStatus: "holiday",
          holidayName: h.holidayName,
        }));

      if (newHolidays.length > 0) {
        attendanceRecord.attendance.set(monthKey, [
          ...existingMonth,
          ...newHolidays,
        ]);
        isModified = true;
      }
    }

    const monthsToProcess = new Set([
      ...Object.keys(groupedHolidays),
      ...Object.keys(attendanceRecord.attendance.toObject()),
    ]);

    for (const monthKey of monthsToProcess) {
      const [year, month] = monthKey.split("-").map(Number);
      const daysInMonth = moment(`${year}-${month}`, "YYYY-MM").daysInMonth();

      const existingMonth = attendanceRecord.attendance.get(monthKey) || [];
      const existingWeekendDates = new Set(
        existingMonth
          .filter((entry) => entry.dateStatus === "weekend")
          .map((entry) => entry.date)
      );

      const sundayEntries = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = moment({ year, month: month - 1, day });
        const formatted = date.format("YYYY-MM-DD");
        if (date.day() === 0 && !existingWeekendDates.has(formatted)) {
          sundayEntries.push({
            date: formatted,
            dateStatus: "weekend",
          });
        }
      }

      if (sundayEntries.length > 0) {
        attendanceRecord.attendance.set(monthKey, [
          ...existingMonth,
          ...sundayEntries,
        ]);
        isModified = true;
      }
    }

    if (isModified) {
      await attendanceRecord.save();
    }

    res.status(200).json({ hasError: false, data: attendanceRecord });
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res
      .status(500)
      .json({ hasError: true, message: "Failed to fetch attendance" });
  }
};

export default getEmployeeAttendance;
