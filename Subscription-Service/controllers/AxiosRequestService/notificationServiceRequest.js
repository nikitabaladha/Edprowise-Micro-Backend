import axios from "axios";

export async function sendNotification(templateKey, recipients, context) {
  try {
    const response = await axios.post(
      `${process.env.NOTIFICATION_SERVICE_URL}/api/send-notification`,
      {
        templateKey,
        recipients,
        context,
      }
    );
    return response.data;
  } catch (err) {
    console.error("Error calling Notification Service:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      config: err.config,
    });

    return {
      hasError: true,
      message: "Failed to store notification.",
      error: err.message,
    };
  }
}
