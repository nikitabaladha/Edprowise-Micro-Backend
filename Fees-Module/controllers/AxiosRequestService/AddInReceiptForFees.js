// /Users/nikita/Desktop/EDPROWISE_Nikita_FINAL/Edprowise_Backend/Edprowise-Micro-Backend/Fees-Module/controllers/AxiosRequestService/AddInReceiptForFees.js
import axios from "axios";

export async function addInReceiptForFees(schoolId, academicYear, paymentData) {
  try {
    const response = await axios.post(
      `${process.env.FINANCE_MODULE_SERVICE_URL}/api/add-receipt-for-fees`,
      paymentData,
      {
        params: {
          schoolId,
          financialYear: academicYear,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to store Receipt for Fees.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error Storing Receipt for Fees:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to Store Receipt for Fees.",
      error: err.message,
    };
  }
}
