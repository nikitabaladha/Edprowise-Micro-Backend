import EmployeeProvidentFund from "../../../models/Employee/EmployeeProvidentFund.js";

const getEmployeePFDetails = async (req, res) => {
  const { schoolId, employeeId, academicYear } = req.params;

  if (!schoolId || !employeeId || !academicYear) {
    return res
      .status(400)
      .json({ hasError: true, message: "Missing parameters" });
  }

  try {
    const data = await EmployeeProvidentFund.findOne({
      schoolId,
      employeeId,
      academicYear,
    });

    return res.status(200).json({
      hasError: false,
      data: data || {},
    });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: error.message });
  }
};

export default getEmployeePFDetails;
