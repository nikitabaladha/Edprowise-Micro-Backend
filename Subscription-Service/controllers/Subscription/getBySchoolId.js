import Subscription from "../../models/Subscription.js";
import { getSchoolById } from "../AxiosRequestService/userServiceRequest.js";

async function getBySchoolId(req, res) {
  try {
    const { schoolId } = req.params;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID is required.",
      });
    }

    const subscriptions = await Subscription.find({ schoolId }).sort({
      createdAt: -1,
    });

    if (!subscriptions.length) {
      return res.status(404).json({
        success: false,
        message: "No subscriptions found for this school.",
      });
    }

    // Fetch school data from User Service
    const schoolResponse = await getSchoolById(schoolId, [
      "schoolId",
      "schoolName",
      "schoolEmail",
      "schoolMobileNo",
    ]);

    const schoolData = !schoolResponse.hasError ? schoolResponse.data : {};

    // Map the subscriptions to the desired format
    const formattedData = subscriptions.map((subscription) => ({
      id: subscription._id,
      schoolId: subscription.schoolId,
      subscriptionFor: subscription.subscriptionFor,
      subscriptionStartDate: subscription.subscriptionStartDate,
      subscriptionNoOfMonth: subscription.subscriptionNoOfMonth,
      monthlyRate: subscription.monthlyRate,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      schoolName: schoolData?.schoolName || null,
      schoolEmail: schoolData?.schoolEmail || null,
      schoolMobileNo: schoolData?.schoolMobileNo || null,
    }));

    return res.status(200).json({
      success: true,
      message: "Subscriptions retrieved successfully.",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching subscriptions.",
    });
  }
}

export default getBySchoolId;
