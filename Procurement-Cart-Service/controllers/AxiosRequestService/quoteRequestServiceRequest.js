// Edprowise-Micro-Backend\Procurement-Quote-Proposal-Service\controllers\AxiosRequestService\quoteRequestServiceRequest.js

import axios from "axios";

export async function getQuoteRequestByEnquiryNumber(enquiryNumber, fields) {
  try {
    const encodedEnquiryNumber = encodeURIComponent(enquiryNumber);
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_REQUEST_SERVICE_URL}/api/quote-requests/${encodedEnquiryNumber}`,
      {
        params: { fields },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get quote request.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting quote request:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get quote request.",
      error: err.message,
    };
  }
}

export async function getQuoteRequestBySchoolIdAndEnqNo(
  enquiryNumber,
  schoolId,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_REQUEST_SERVICE_URL}/api/quote-request-by-schoolid-enqnos`,
      {
        params: {
          enquiryNumber,
          schoolId,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get quote request.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting quote request:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get quote request.",
      error: err.message,
    };
  }
}

export async function updateQuoteRequest(enquiryNumber, schoolId, updateData) {
  try {
    const response = await axios.put(
      `${process.env.PROCUREMENT_QUOTE_REQUEST_SERVICE_URL}/api/update-quote-request`,
      updateData,
      {
        params: { enquiryNumber, schoolId },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to update quote request.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error updating quote request:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to update quote request.",
      error: err.message,
    };
  }
}

export async function updateQuoteRequestStatus(enquiryNumber, updateData) {
  try {
    const encodedEnquiryNumber = encodeURIComponent(enquiryNumber);
    const response = await axios.put(
      `${process.env.PROCUREMENT_QUOTE_REQUEST_SERVICE_URL}/api/quote-requests/${encodedEnquiryNumber}/status`,
      updateData
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to update quote request.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error updating quote request:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to update quote request.",
      error: err.message,
    };
  }
}

export async function fetchQuoteRequestByEnqNos(enquiryNumbers, fields) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_REQUEST_SERVICE_URL}/api/quote-request-by-enqnos`,
      {
        params: {
          enquiryNumbers: Array.isArray(enquiryNumbers)
            ? enquiryNumbers.join(",")
            : enquiryNumbers,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get quote request.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting quote request:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get quote request.",
      error: err.message,
    };
  }
}
