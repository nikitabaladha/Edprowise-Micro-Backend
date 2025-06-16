import axios from "axios";

export async function getOrderDetailsFromSellerBySchooIdSellerId(
  schoolId,
  sellerId,
  fields
) {
  try {
    const response = await axios.get(
      `${process.env.PROCUREMENT_ORDER_SERVICE_URL}/api/get-order-from-seller`,
      {
        params: { schoolId, sellerId, fields },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get order from seller.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting order from seller:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get order from seller.",
      error: err.message,
    };
  }
}
