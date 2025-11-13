import CarryForwardModel from "../../../models/AdminSettings/SchoolAnnualLeaveCarryForwardRule.js";

const getCarryForwardConditions = async (req, res) => {
  try {
    const { schoolId, leaveTypeId } = req.params;
    const { academicYear } = req.query;

    if (!schoolId || !leaveTypeId || !academicYear) {
      return res
        .status(400)
        .json({ hasError: true, message: "Missing required params" });
    }

    const setting = await CarryForwardModel.findOne({
      schoolId,
      academicYear,
      leaveTypeId,
    });

    res.status(200).json({ hasError: false, data: setting || {} });
  } catch (error) {
    console.error("Error in getCarryForwardSetting:", error);
    res.status(500).json({ hasError: true, message: "Internal server error" });
  }
};

export default getCarryForwardConditions;
