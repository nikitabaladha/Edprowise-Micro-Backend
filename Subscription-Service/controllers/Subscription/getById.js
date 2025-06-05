import Subscription from "../../models/Subscription.js";

import axios from "axios";

async function getById(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        hasError: true,
        message: "Subscription ID is required.",
      });
    }

    const subscription = await Subscription.findById(id);

    if (!subscription) {
      return res.status(404).json({
        hasError: true,
        message: "Subscription not found with the provided ID.",
      });
    }

    const accessToken = req.headers["access_token"];

    if (!accessToken) {
      return res.status(401).json({
        hasError: true,
        message: "Access token is missing",
      });
    }

    let school;

    try {
      const response = await axios.get(
        `${process.env.USER_SERVICE_URL}/api/school/${subscription.schoolId}`,
        {
          headers: {
            access_token: accessToken,
          },
        }
      );
      school = response.data.data;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(404).json({
          hasError: true,
          message: "School not found.",
        });
      }

      console.error("Error fetching school from User-Service:", err.message);
      return res.status(500).json({
        hasError: true,
        message: "Failed to fetch school details from User-Service.",
      });
    }

    const formattedSubscription = {
      id: subscription._id,
      subscriptionFor: subscription.subscriptionFor,
      subscriptionStartDate: subscription.subscriptionStartDate,
      subscriptionNoOfMonth: subscription.subscriptionNoOfMonth,
      monthlyRate: subscription.monthlyRate,
      schoolId: subscription.schoolId,
      schoolID: school?._id || null,
      schoolName: school?.schoolName || null,
      schoolMobileNo: school?.schoolMobileNo || null,
      schoolEmail: school?.schoolEmail || null,
      profileImage: school?.profileImage || null,
      schoolAddress: school?.schoolAddress || null,
    };

    return res.status(200).json({
      hasError: false,
      message: "Subscription retrieved successfully",
      data: formattedSubscription,
    });
  } catch (error) {
    console.error("Error in getSubscriptionById API:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Server error",
      error: error.message,
    });
  }
}

export default getById;
