import OrderDetailsFromSeller from "../../models/OrderDetailsFromSeller.js";

import {
  updateQuoteProposal,
  updateSubmitQuote,
  getQuoteProposal,
  fetchPrepareQuotes,
  fetchSubmitQuoteBySellerIdAndEnqNos,
  fetchSubmitQuoteBySellerIdsAndEnqNo,
} from "../AxiosRequestService/quoteProposalServiceRequest.js";

import {
  getallSellersByIds,
  getAllEdprowiseAdmins,
  getrequiredFieldsFromEdprowiseProfile,
  getSchoolById,
  getSellerById,
  getSellerByDealingProducts,
} from "../AxiosRequestService/userServiceRequest.js";

// import { NotificationService } from "../../../notificationService.js";

async function CancelOrderByEdprowise(req, res) {
  try {
    const { enquiryNumber, sellerId, schoolId } = req.query;
    const { edprowiseStatus } = req.body;

    if (!enquiryNumber || !sellerId || !schoolId) {
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumber, sellerId and schoolId are required.",
      });
    }

    const allowedStatuses = ["Cancelled"];

    if (!allowedStatuses.includes(edprowiseStatus)) {
      return res.status(400).json({
        hasError: true,
        message: `Invalid EdprowiseStatus. Allowed values: ${allowedStatuses.join(
          ", "
        )}`,
      });
    }

    const existingQuoteResponse = await getQuoteProposal(
      enquiryNumber,
      sellerId
    );

    if (existingQuoteResponse.hasError || !existingQuoteResponse.data) {
      return res.status(404).json({
        hasError: true,
        message: "Quote not found for the given enquiryNumber and sellerId.",
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

    const schoolProfileResponse = await getSchoolById(schoolId, ["schoolName"]);

    if (schoolProfileResponse.hasError || !schoolProfileResponse.data) {
      return res.status(404).json({
        hasError: true,
        message: `School not found for given school ID ${schoolId}.`,
      });
    }
    const schoolProfile = schoolProfileResponse.data;

    const sellerProfileResponse = await getSellerById(sellerId, [
      "companyName",
    ]);
    if (sellerProfileResponse.hasError || !sellerProfileResponse.data) {
      return res.status(404).json({
        hasError: true,
        message: `Seller not found for given seller ID ${sellerId}.`,
      });
    }
    const sellerProfile = sellerProfileResponse.data;

    const edprowiseAdminsResponse = await getAllEdprowiseAdmins(["_id"]);

    if (edprowiseAdminsResponse.hasError || !edprowiseAdminsResponse.data) {
      return res.status(500).json({
        hasError: true,
        message: "Failed to fetch Edprowise admin users.",
      });
    }

    const relevantEdprowise = edprowiseAdminsResponse.data;

    const updatedQuoteResponse = await updateQuoteProposal(
      enquiryNumber,
      sellerId,
      {
        buyerStatus: edprowiseStatus,
        supplierStatus: edprowiseStatus,
        edprowiseStatus: edprowiseStatus,
      }
    );

    if (updatedQuoteResponse.hasError || !updatedQuoteResponse.data) {
      return res.status(500).json({
        hasError: true,
        message: "Failed to update quote proposal.",
        error: updatedQuoteResponse.error || "Unknown error",
      });
    }

    const updatedQuote = updatedQuoteResponse.data;

    const senderId = req.user.id;

    // await NotificationService.sendNotification(
    //   "EDPROWISE_CANCELLED_ORDER",
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
    //     senderType: "edprowise",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "order_cancelled_by_edprowise",
    //     },
    //   }
    // );

    // await NotificationService.sendNotification(
    //   "EDPROWISE_CANCELLED_ORDER_FOR_SCHOOL",
    //   [
    //     {
    //       id: existingOrderDetailsFromSeller.schoolId.toString(),
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
    //     senderType: "edprowise",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "order_cancelled_by_edprowise",
    //     },
    //   }
    // );

    // await NotificationService.sendNotification(
    //   "EDPROWISE_CANCELLED_ORDER_FOR_SELLER",
    //   [
    //     {
    //       id: existingOrderDetailsFromSeller.sellerId.toString(),
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
    //     senderType: "edprowise",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "order_cancelled_by_edprowise",
    //     },
    //   }
    // );

    return res.status(200).json({
      hasError: false,
      message: "Order Cancelled by Edprowise successfully.",
      data: updatedQuote,
    });
  } catch (error) {
    console.error("Error Cancelling Order by Edprowise.", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default CancelOrderByEdprowise;
