// Fees-Module/controllers/AxiosRequestService/AddLedgerForFeesType.js

import axios from "axios";

export async function addLedgerForFeesType(schoolId, academicYear, ledgerData) {
  try {
    const response = await axios.post(
      `${process.env.FINANCE_MODULE_SERVICE_URL}/api/add-ledger-for-feestype`,
      ledgerData,
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
        message: "Failed to store Ledger for Fees.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error Storing Ledger for Fees:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to Store Ledger for Fees.",
      error: err.message,
    };
  }
}
