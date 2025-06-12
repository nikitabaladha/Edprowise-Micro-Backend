import { NotificationService } from "../../notificationService.js";

async function sendNotification(req, res) {
  const { templateKey, recipients, context } = req.body;

  try {
    const notifications = await NotificationService.sendNotification(
      templateKey,
      recipients,
      context
    );

    res.status(200).json({
      hasError: false,
      message: "Notification sent successfully.",
      data: notifications,
    });
  } catch (error) {
    console.error("Notification sending failed:", error.message);
    res.status(500).json({
      hasError: true,
      message: "Failed to send notification.",
    });
  }
}

export default sendNotification;
