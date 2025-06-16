import axios from "axios";

export async function getallSellersByIds(sellerIds, fields) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/bulk-required-fields-from-seller-profile`,
      {
        params: {
          ids: sellerIds.join(","),
          fields,
        },
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error in getallSellersByIds:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to fetch all sellers.",
      error: err.message,
    };
  }
}
