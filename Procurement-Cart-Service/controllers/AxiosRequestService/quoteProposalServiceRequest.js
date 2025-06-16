import axios from "axios";

export async function fetchPrepareQuotes(enquiryNumber, ids, fields) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/get-prepare-quotes`,
      {
        params: {
          enquiryNumber,
          ids: Array.isArray(ids) ? ids.join(",") : ids,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get prepare quotes.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting prepare quotes:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get prepare quotes.",
      error: err.message,
    };
  }
}

export async function updateSubmitQuote(enquiryNumber, sellerId, updateData) {
  try {
    const response = await axios.put(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/update-submitquote-by-status`,
      updateData,
      {
        params: { enquiryNumber, sellerId },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to update submit quote.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error updating submit quote:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to update submit quote.",
      error: err.message,
    };
  }
}

export async function fetchSubmitQuoteBySellerIdsAndEnqNo(
  sellerIds,
  enquiryNumber,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/submitquote-by-Sellerids-and-enq-no`,
      {
        params: {
          sellerIds: Array.isArray(sellerIds) ? sellerIds.join(",") : sellerIds,
          enquiryNumber,
          fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get submit quotes.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting submit quotes:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get submit quotes.",
      error: err.message,
    };
  }
}
