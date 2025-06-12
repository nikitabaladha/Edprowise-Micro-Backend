import Subscription from "../../models/Subscription.js";

async function getSubscriptionBySchoolId(req, res) {
  try {
    const { schoolId, fields } = req.query;

    if (!schoolId) {
      return res.status(400).json({
        hasError: true,
        message: "SchoolId is required",
      });
    }

    let projection = {};
    if (fields?.trim()) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1;
      });
    }

    const subscriptions = await Subscription.find({
      schoolId,
    }).select(projection);

    return res.status(200).json({
      hasError: false,
      data: subscriptions,
    });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getSubscriptionBySchoolId;
