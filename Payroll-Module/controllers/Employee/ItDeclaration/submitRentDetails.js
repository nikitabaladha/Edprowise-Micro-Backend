import EmployeeRentDetail from "../../../models/Employee/EmployeeRentDetail.js";
import ItDeclaration from "../../../models/Employee/ItDeclaration.js";
import EmployeeCTC from "../../../models/Employer/EmployeeCTC.js";
import fs from "fs";
import path from "path";

const submitRentDetails = async (req, res) => {
  try {
    const {
      academicYear,
      schoolId: bodySchoolId,
      employeeId: bodyEmployeeId,
      status,
    } = req.body;
    const sessionUserDetails = req.session?.userDetails || {};
    const schoolId = sessionUserDetails.schoolId || bodySchoolId;
    const employeeId = sessionUserDetails.userId || bodyEmployeeId;

    console.log("Received data:", {
      schoolId,
      employeeId,
      academicYear,
      rentDetails: req.body.rentDetails,
    });

    if (!schoolId || !employeeId || !academicYear) {
      console.error("Missing required fields:", {
        schoolId,
        employeeId,
        academicYear,
      });
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: schoolId, employeeId, or academicYear",
      });
    }

    const ctc = await EmployeeCTC.findOne({
      schoolId,
      employeeId,
      academicYear,
    }).lean();
    if (!ctc) {
      console.error("CTC data not found:", {
        schoolId,
        employeeId,
        academicYear,
      });
      return res.status(400).json({
        success: false,
        message: "CTC data not found for the employee and academic year",
      });
    }

    const monthOrder = [
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
      "January",
      "February",
      "March",
    ];

    const getCtcForMonth = (monthName, ctcData) => {
      const monthIndex = monthOrder.indexOf(monthName);
      if (monthIndex === -1) {
        throw new Error(`Invalid month: ${monthName}`);
      }

      const fiscalYearStart = parseInt(academicYear.split("-")[0]);
      const calendarMonth = (monthIndex + 3) % 12;
      const year = monthIndex < 9 ? fiscalYearStart : fiscalYearStart + 1;
      const monthEnd = new Date(year, calendarMonth + 1, 0);

      const applicableDate = new Date(ctcData.applicableDate);
      let selectedCtc = null;
      if (applicableDate <= monthEnd) {
        selectedCtc = {
          components: ctcData.components,
          totalAnnualCost: ctcData.totalAnnualCost,
          applicableDate: ctcData.applicableDate,
        };
      } else {
        const validHistory = ctcData.history
          .filter((h) => new Date(h.applicableDate) <= monthEnd)
          .sort(
            (a, b) => new Date(b.applicableDate) - new Date(a.applicableDate)
          );
        if (validHistory.length > 0) {
          selectedCtc = {
            components: validHistory[0].components,
            totalAnnualCost: validHistory[0].totalAnnualCost,
            applicableDate: validHistory[0].applicableDate,
          };
        }
      }

      if (!selectedCtc) {
        return {
          monthlyHRA: 0,
          monthlyBasicSalary: 0,
        };
      }

      const hraComponent = selectedCtc.components.find((comp) =>
        comp.ctcComponentName.toLowerCase().includes("hra")
      );
      const basicSalaryComponent = selectedCtc.components.find((comp) =>
        comp.ctcComponentName.toLowerCase().includes("basic salary")
      );

      if (!hraComponent || !basicSalaryComponent) {
        throw new Error(
          `HRA or Basic Salary component not found in CTC for ${monthName}`
        );
      }

      return {
        monthlyHRA: (hraComponent.annualAmount || 0) / 12,
        monthlyBasicSalary: (basicSalaryComponent.annualAmount || 0) / 12,
      };
    };

    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    const maxFileSize = 2 * 1024 * 1024;
    const filesByField = {};
    (req.files || []).forEach((file) => {
      const match = file.fieldname.match(/rentReceipts\[(\d+)\]/);
      if (match) {
        const index = parseInt(match[1]);
        filesByField[index] = file;
      }
    });

    if (
      !Array.isArray(req.body.rentDetails) ||
      req.body.rentDetails.length !== 12
    ) {
      console.error("Invalid rentDetails array:", req.body.rentDetails);
      return res.status(400).json({
        success: false,
        message: "rentDetails must be an array of 12 months",
      });
    }

    const rentDetails = [];
    let totalDeclaredRent = 0;
    let totalMonthActualHRAReceivedMetro = 0;
    let totalMonthActualRentPaidMetro = 0;
    let totalMonthBasicSalaryMetro = 0;
    let totalMonthActualHRAReceivedNonMetro = 0;
    let totalMonthActualRentPaidNonMetro = 0;
    let totalMonthBasicSalaryNonMetro = 0;

    for (const [index, detail] of req.body.rentDetails.entries()) {
      const {
        month,
        declaredRent,
        cityType,
        landlordName,
        landlordPanNumber,
        landlordAddress,
        existingRentReceipt,
        monthStatus,
      } = detail;
      const rentReceipt = filesByField[index]?.path;
      const declaredRentValue = parseFloat(declaredRent) || 0;

      console.log(`Processing rentDetails[${index}]:`, {
        month,
        declaredRentValue,
        cityType,
        landlordName,
        landlordPanNumber,
        landlordAddress,
        rentReceipt,
      });

      if (rentReceipt) {
        const file = filesByField[index];
        if (!validTypes.includes(file.mimetype)) {
          throw new Error(
            `Invalid file type for rentDetails[${index}]. Only JPEG, PNG, or PDF allowed.`
          );
        }
        if (file.size > maxFileSize) {
          throw new Error(`File size for rentDetails[${index}] exceeds 2MB.`);
        }
      }

      const normalizedExistingRentReceipt = existingRentReceipt
        ? path.normalize(existingRentReceipt)
        : null;
      const normalizedRentReceipt = rentReceipt
        ? path.normalize(rentReceipt)
        : null;

      if (declaredRentValue > 0) {
        if (!month || !monthOrder.includes(month)) {
          throw new Error(`Invalid or missing month for rentDetails[${index}]`);
        }
        if (!cityType || !["Metro", "Non-Metro"].includes(cityType)) {
          throw new Error(
            `Invalid or missing cityType for rentDetails[${index}]`
          );
        }
        if (
          !landlordName ||
          !landlordAddress ||
          (!normalizedRentReceipt && !normalizedExistingRentReceipt)
        ) {
          throw new Error(
            `Missing required fields for rentDetails[${index}]: landlordName, landlordAddress, or rentReceipt`
          );
        }
        if (declaredRentValue > 100000 && !landlordPanNumber) {
          throw new Error(
            `Missing landlordPanNumber for rentDetails[${index}] with declaredRent > ₹1,00,000`
          );
        }

        const { monthlyHRA, monthlyBasicSalary } = getCtcForMonth(month, ctc);
        const monthActualRentPaid = declaredRentValue;
        const monthBasicSalaryCity = parseFloat(monthlyBasicSalary);

        if (
          normalizedRentReceipt &&
          normalizedExistingRentReceipt &&
          fs.existsSync(normalizedExistingRentReceipt)
        ) {
          fs.unlinkSync(normalizedExistingRentReceipt);
          console.log(`Deleted old file: ${normalizedExistingRentReceipt}`);
        }

        rentDetails.push({
          month,
          declaredRent: declaredRentValue,
          cityType,
          landlordName,
          landlordPanNumber: landlordPanNumber || "",
          landlordAddress,
          rentReceipt: normalizedRentReceipt || normalizedExistingRentReceipt,
          monthActualHRAReceived: monthlyHRA,
          monthActualRentPaid,
          monthBasicSalaryCity,
          monthStatus: monthStatus || "Pending",
        });

        totalDeclaredRent += declaredRentValue;
        if (cityType === "Metro") {
          totalMonthActualHRAReceivedMetro += monthlyHRA;
          totalMonthActualRentPaidMetro += monthActualRentPaid;
          totalMonthBasicSalaryMetro += monthBasicSalaryCity;
        } else if (cityType === "Non-Metro") {
          totalMonthActualHRAReceivedNonMetro += monthlyHRA;
          totalMonthActualRentPaidNonMetro += monthActualRentPaid;
          totalMonthBasicSalaryNonMetro += monthBasicSalaryCity;
        }
      } else {
        rentDetails.push({
          month,
          declaredRent: 0,
          cityType: "",
          landlordName: "",
          landlordPanNumber: "",
          landlordAddress: "",
          rentReceipt: null,
          monthActualHRAReceived: 0,
          monthActualRentPaid: 0,
          monthBasicSalaryCity: 0,
          monthStatus: "Pending",
        });
      }
    }

    if (rentDetails.length === 0) {
      console.error("No rent details provided");
      return res.status(400).json({
        success: false,
        message: "No rent details provided",
      });
    }

    // Metro calculations
    const actualHRAReceivedMetro = totalMonthActualHRAReceivedMetro;
    const basicSalaryMetroCity = totalMonthBasicSalaryMetro * 0.5;
    const actualRentPaidMetro =
      totalMonthActualRentPaidMetro - totalMonthBasicSalaryMetro * 0.1;
    const metroHraExemption = Math.min(
      actualHRAReceivedMetro,
      actualRentPaidMetro,
      basicSalaryMetroCity
    );

    // Non-Metro calculations
    const actualHRAReceivedNonMetro = totalMonthActualHRAReceivedNonMetro;
    const basicSalaryNonMetroCity = totalMonthBasicSalaryNonMetro * 0.4;
    const actualRentPaidNonMetro =
      totalMonthActualRentPaidNonMetro - totalMonthBasicSalaryNonMetro * 0.1;
    const nonMetroHraExemption = Math.min(
      actualHRAReceivedNonMetro,
      actualRentPaidNonMetro,
      basicSalaryNonMetroCity
    );

    // totals
    const actualHRAReceived =
      actualHRAReceivedMetro + actualHRAReceivedNonMetro;
    const actualRentPaid = parseFloat(
      (actualRentPaidMetro + actualRentPaidNonMetro).toFixed(0)
    );
    const basicSalaryCity = parseFloat(
      (basicSalaryMetroCity + basicSalaryNonMetroCity).toFixed(0)
    );
    const rentPaidMinusTenPercent = actualRentPaid - basicSalaryCity * 0.1;
    const hraExemption = parseFloat(
      (metroHraExemption + nonMetroHraExemption).toFixed(0)
    );

    console.log("Totals:", {
      actualHRAReceived,
      actualRentPaid,
      basicSalaryCity,
      rentPaidMinusTenPercent,
      hraExemption,
      metroHraExemption,
      nonMetroHraExemption,
    });

    rentDetails.sort(
      (a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
    );

    const rentDetailData = {
      schoolId,
      employeeId,
      academicYear,
      actualHRAReceived,
      actualRentPaid,
      basicSalaryCity,
      hraExemption,
      status,
      rentDetails,
    };

    console.log("Saving rent details:", rentDetailData);

    const rentDetail = await EmployeeRentDetail.findOneAndUpdate(
      { schoolId, employeeId, academicYear },
      rentDetailData,
      { upsert: true, new: true, runValidators: true }
    );

    console.log("Rent detail saved:", rentDetail);

    await ItDeclaration.findOneAndUpdate(
      { schoolId, employeeId, academicYear },
      { "hraExemption.rentDetailsId": rentDetail._id },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      data: rentDetail,
      message: "Rent details submitted successfully",
    });
  } catch (error) {
    if (req.files) {
      req.files.forEach((file) => {
        const normalizedPath = path.normalize(file.path);
        if (fs.existsSync(normalizedPath)) {
          fs.unlinkSync(normalizedPath);
          console.log(`Cleaned up file: ${normalizedPath}`);
        }
      });
    }
    console.error("Error submitting rent details:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
export default submitRentDetails;
