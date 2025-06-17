import Subscription from "../../models/Subscription.js";
import { getSchoolById } from "../AxiosRequestService/userServiceRequest.js";

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

    console.log("subscription.schoolId=====", subscription.schoolId);

    const schoolResponse = await getSchoolById(subscription.schoolId, [
      "schoolId",
      "schoolName",
      "schoolMobileNo",
      "schoolEmail",
      "profileImage",
      "schoolAddress",
    ]);

    console.log("schoolResponse=====", schoolResponse);

    if (schoolResponse.hasError) {
      if (schoolResponse.status === 404) {
        return res.status(404).json({
          hasError: true,
          message: "School not found.",
        });
      }

      return res.status(500).json({
        hasError: true,
        message: "Failed to fetch school details from User-Service.",
        error: schoolResponse.error,
      });
    }

    const school = schoolResponse.data;

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
