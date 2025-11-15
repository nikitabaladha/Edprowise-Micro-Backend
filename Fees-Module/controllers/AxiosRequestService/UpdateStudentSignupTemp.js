// Edprowise-Micro-Backend/Fees-Module/controllers/AxiosRequestService/UpdateStudentSignupTemp.js
import axios from "axios";
 
export async function UpdateStudentSignupTemp(
  schoolId,
  updateData
) {
  try {
    const response = await axios.put(
      `${process.env.USER_SERVICE_URL}/api/update-student-signup-temp`,
      updateData,
      {
        params: {
          schoolId,
        },
      }
    );
 
    return response.data; // Return the exact response from the API
  } catch (err) {
    console.error("Error updating Student Signup Temp:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
 
    // Return the same structure as the API response
    return {
      hasError: true,
      message: "Failed to update Student Signup Temp via API.",
      error: err.message,
    };
  }
}