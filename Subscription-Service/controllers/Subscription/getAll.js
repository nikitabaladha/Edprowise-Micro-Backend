import Subscription from "../../models/Subscription.js";

import axios from "axios";

async function getAllSubscription(req, res) {
  try {
    const subscriptions = await Subscription.find().sort({ createdAt: -1 });

    if (!subscriptions.length) {
      return res.status(404).json({
        hasError: true,
        message: "No Subscriptions found",
        data: [],
      });
    }

    const schoolIds = subscriptions.map(
      (subscription) => subscription.schoolId
    );

    let schools = [];

    try {
      const response = await axios.get(
        `${
          process.env.USER_SERVICE_URL
        }/api/get-school-by-ids?ids=${schoolIds.join(",")}`
      );
      schools = response.data.data;
    } catch (error) {
      console.error("Error fetching schools from User-Service:", error.message);
      // Continue with empty array if school fetch fails
      schools = [];
    }

    const schoolMap = new Map(
      schools.map((school) => [school.schoolId, school])
    );

    const formattedSubscriptions = subscriptions.map((subscription) => ({
      id: subscription._id,
      subscriptionFor: subscription.subscriptionFor,
      subscriptionStartDate: subscription.subscriptionStartDate,
      subscriptionNoOfMonth: subscription.subscriptionNoOfMonth,
      monthlyRate: subscription.monthlyRate,
      schoolId: subscription.schoolId,
      schoolName: schoolMap.get(subscription.schoolId)?.schoolName || null,
      schoolMobileNo:
        schoolMap.get(subscription.schoolId)?.schoolMobileNo || null,
      schoolEmail: schoolMap.get(subscription.schoolId)?.schoolEmail || null,
      profileImage: schoolMap.get(subscription.schoolId)?.profileImage || null,
      schoolAddress:
        schoolMap.get(subscription.schoolId)?.schoolAddress || null,
      schoolLocation:
        schoolMap.get(subscription.schoolId)?.schoolLocation || null,
    }));

    return res.status(200).json({
      hasError: false,
      message: "Subscriptions retrieved successfully 12345678",
      data: formattedSubscriptions,
    });
  } catch (error) {
    console.error("Error in getAllSubscription API:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Server error",
      error: error.message,
    });
  }
}

export default getAllSubscription;
