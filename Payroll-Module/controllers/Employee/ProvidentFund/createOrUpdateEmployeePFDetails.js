import EmployeeProvidentFund from "../../../models/Employee/EmployeeProvidentFund.js";

const createOrUpdateEmployeePFDetails = async (req, res) => {
  const { schoolId, employeeId, academicYear, pfData } = req.body;

  if (!schoolId || !employeeId || !academicYear || !pfData) {
    return res
      .status(400)
      .json({ hasError: true, message: "Missing required fields" });
  }

  const month = Object.keys(pfData)[0];
  const record = {
    monthLabel: month,
    mandatoryPFContribution: pfData[month].mandatoryPFContribution,
    voluntaryPFContribution: parseFloat(pfData[month].voluntaryPFContribution),
  };

  try {
    let existing = await EmployeeProvidentFund.findOne({
      schoolId,
      employeeId,
      academicYear,
    });

    if (existing) {
      // Update existing month or push new
      const index = existing.pfRecords.findIndex((r) => r.monthLabel === month);
      if (index > -1) {
        existing.pfRecords[index] = record; // update
      } else {
        existing.pfRecords.push(record); // add
      }

      await existing.save();
      return res
        .status(200)
        .json({ hasError: false, message: "PF month updated", data: existing });
    } else {
      // New doc
      const newDoc = await EmployeeProvidentFund.create({
        schoolId,
        employeeId,
        academicYear,
        pfRecords: [record],
      });

      return res
        .status(200)
        .json({ hasError: false, message: "PF record created", data: newDoc });
    }
  } catch (error) {
    return res.status(500).json({ hasError: true, message: error.message });
  }
};

export default createOrUpdateEmployeePFDetails;
