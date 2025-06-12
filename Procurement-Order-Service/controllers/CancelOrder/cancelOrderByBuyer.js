import OrderDetailsFromSeller from "../../models/OrderDetailsFromSeller.js";

// import { NotificationService } from "../../../notificationService.js";

import {
  updateQuoteProposal,
  updateSubmitQuote,
  getQuoteProposal,
} from "../AxiosRequestService/quoteProposalServiceRequest.js";

import {
  getSchoolById,
  getSellerById,
  getallSellersByIds,
  getAllEdprowiseAdmins,
} from "../AxiosRequestService/userServiceRequest.js";

async function CancelOrderByBuyer(req, res) {
  try {
    const { enquiryNumber, sellerId, schoolId } = req.query;
    const { buyerStatus } = req.body;

    if (!enquiryNumber || !sellerId || !schoolId) {
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumber, sellerId and schoolId are required.",
      });
    }

    const allowedStatuses = ["Cancelled by Buyer"];

    if (!allowedStatuses.includes(buyerStatus)) {
      return res.status(400).json({
        hasError: true,
        message: `Invalid buyerStatus. Allowed values: ${allowedStatuses.join(
          ", "
        )}`,
      });
    }

    const updateData = {
      buyerStatus,
      supplierStatus: buyerStatus,
      edprowiseStatus: buyerStatus,
    };

    const updatedQuoteProposal = await updateQuoteProposal(
      enquiryNumber,
      sellerId,
      updateData
    );

    if (updatedQuoteProposal?.hasError) {
      return res.status(500).json({
        hasError: true,
        message: updatedQuote.message,
      });
    }

    const updatedQuote = updatedQuoteProposal.data;

    const schoolProfile = await getSchoolById(schoolId);

    if (!schoolProfile) {
      return res.status(404).json({
        hasError: true,
        message: `School not found for given school ID ${schoolId}.`,
      });
    }

    const sellerProfile = await getSellerById(sellerId);

    if (sellerProfile?.hasError || !sellerProfile?.data) {
      return res.status(404).json({
        hasError: true,
        message: `Seller not found for given seller ID ${sellerId}.`,
      });
    }

    const existingOrderDetailsFromSeller = await OrderDetailsFromSeller.findOne(
      {
        sellerId,
        enquiryNumber,
      }
    );

    if (!existingOrderDetailsFromSeller) {
      return res.status(404).json({
        hasError: true,
        message: `No Order details found for enquiry number ${enquiryNumber} and seller ID ${sellerId}.`,
      });
    }

    const senderId = req.user.schoolId;

    const relevantEdprowise = await getAllEdprowiseAdmins();
    if (
      relevantEdprowise?.hasError ||
      !Array.isArray(relevantEdprowise?.data)
    ) {
      return res.status(500).json({
        hasError: true,
        message: `Failed to fetch admin user list.`,
      });
    }

    // await NotificationService.sendNotification(
    //   "SCHOOL_CANCELLED_ORDER_FOR_EDPROWISE",
    //   relevantEdprowise.map((admin) => ({
    //     id: admin._id.toString(),
    //     type: "edprowise",
    //   })),
    //   {
    //     companyName: sellerProfile.companyName,
    //     schoolName: schoolProfile.schoolName,
    //     orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //     enquiryNumber: existingOrderDetailsFromSeller.enquiryNumber,
    //     entityId: existingOrderDetailsFromSeller._id,
    //     entityType: "Order Cancel",
    //     senderType: "school",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "order_cancelled_by_school",
    //     },
    //   }
    // );

    // await NotificationService.sendNotification(
    //   "SCHOOL_CANCELLED_ORDER_FOR_SCHOOL",
    //   [
    //     {
    //       id: schoolId.toString(),
    //       type: "school",
    //     },
    //   ],
    //   {
    //     companyName: sellerProfile.companyName,
    //     schoolName: schoolProfile.schoolName,
    //     orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //     enquiryNumber: existingOrderDetailsFromSeller.enquiryNumber,
    //     entityId: existingOrderDetailsFromSeller._id,
    //     entityType: "Order Cancel",
    //     senderType: "school",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "order_cancelled_by_school",
    //     },
    //   }
    // );

    // await NotificationService.sendNotification(
    //   "SCHOOL_CANCELLED_ORDER_FOR_SELLER",
    //   [
    //     {
    //       id: sellerId.toString(),
    //       type: "seller",
    //     },
    //   ],
    //   {
    //     companyName: sellerProfile.companyName,
    //     schoolName: schoolProfile.schoolName,
    //     orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //     enquiryNumber: existingOrderDetailsFromSeller.enquiryNumber,
    //     entityId: existingOrderDetailsFromSeller._id,
    //     entityType: "Order Cancel",
    //     senderType: "school",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "order_cancelled_by_school",
    //     },
    //   }
    // );

    return res.status(200).json({
      hasError: false,
      message: "Order Cancelled by school successfully.",
      data: updatedQuote,
    });
  } catch (error) {
    console.error("Error Cancelling Order by School.", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default CancelOrderByBuyer;
