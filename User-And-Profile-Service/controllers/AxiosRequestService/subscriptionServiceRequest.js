import axios from "axios";

export async function getSubscriptionBySchoolId(schoolId, fields) {
  try {
    const response = await axios.get(
      `${process.env.SUBSCRIPTION_SERVICE_URL}/api/get-subscription-by-schoolid`,
      {
        params: { schoolId, fields },
      }
    );

    if (response.data.hasError) {
      return {
        hasError: true,
        message: "Failed to get subscription.",
        error: response.data.error || "Unknown error",
      };
    }

    return response.data;
  } catch (err) {
    console.error("Error getting subscription:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to get quote proposal.",
      error: err.message,
    };
  }
}
