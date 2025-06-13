import axios from "axios";

export async function getOrderFromBuyerByEnquiryNumbers(
  enquiryNumbers,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_ORDER_SERVICE_URL}/api/get-order-from-buyer`,
      {
        params: {
          enquiryNumbers: Array.isArray(enquiryNumbers)
            ? enquiryNumbers.join(",")
            : enquiryNumbers,
          fields: Array.isArray(fields) ? fields.join(",") : fields,
        },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get Get Order From Buyer By EnquiryNumbers.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting Order From Buyer By EnquiryNumbers:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get Order From Buyer By EnquiryNumbers.",
      error: err.message,
    };
  }
}
