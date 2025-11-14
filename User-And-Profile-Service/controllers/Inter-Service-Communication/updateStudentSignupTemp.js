// Edprowise-Micro-Backend/User-And-Profile-Service/controllers/Inter-Service-Communication/updateStudentSignupTemp.js
 
import TempStudent from "../../models/StudentSignupTemp.js";
 
async function updateStudentSignupTemp(req, res) {
  try {
    const { schoolId } = req.query;
    const updateData = req.body;
 
    if (!schoolId ) {
      return res.status(400).json({
        hasError: true,
        message: "'schoolId'  are required in query.",
      });
    }
 
    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        hasError: true,
        message: "Update data must be provided in request body.",
      });
    }
 
    // Exact equivalent of findOneAndUpdate
    const updatedTemp = await TempStudent.findOneAndUpdate(
      {
        schoolId,
        email: updateData.email.trim().toLowerCase(),
      },
      { $set: { registrationFormId: updateData.registrationFormId } },
      { new: true, runValidators: true }
    );
 
    if (!updatedTemp) {
      return res.status(404).json({
        hasError: true,
        message: `No TempStudent found for schoolId=${schoolId} & email=${updateData.email}`,
      });
    }
 
    return res.status(200).json({
      hasError: false,
      message: "Student Signup Temp updated successfully.",
      data: updatedTemp,
    });
  } catch (error) {
    console.error("Error updating Student Signup Temp:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
      error: error.message,
    });
  }
}
 
export default updateStudentSignupTemp;
 