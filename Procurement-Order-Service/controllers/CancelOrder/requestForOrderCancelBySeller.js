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

async function requestForOrderCancelBySeller(req, res) {
  try {
    const { enquiryNumber, sellerId, schoolId } = req.query;
    const { cancelReasonFromSeller } = req.body;

    if (!enquiryNumber || !sellerId || !schoolId) {
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumber, sellerId and schoolId are required.",
      });
    }

    if (!cancelReasonFromSeller || cancelReasonFromSeller.trim() === "") {
      return res.status(400).json({
        hasError: true,
        message: "Comment is required if you want to request for order cancel.",
      });
    }

    const updatedQuoteResponse = await updateQuoteProposal(
      enquiryNumber,
      sellerId,
      {
        cancelReasonFromSeller,
        supplierStatus: "Requested For Cancel",
      }
    );

    if (updatedQuoteResponse.hasError || !updatedQuoteResponse.data) {
      return res.status(404).json({
        hasError: true,
        message:
          updatedQuoteResponse.message || "Failed to update quote proposal.",
        error: updatedQuoteResponse.error || null,
      });
    }

    const updatedQuote = updatedQuoteResponse.data;

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

    const senderId = req.user.id;

    // await NotificationService.sendNotification(
    //   "SELLER_REQUESTED_FOR_ORDER_CANCEL_FOR_EDPROWISE",
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
    //     senderType: "seller",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "order_cancel_request_by_seller",
    //     },
    //   }
    // );

    // await NotificationService.sendNotification(
    //   "SELLER_REQUESTED_FOR_ORDER_CANCEL_FOR_SCHOOL",
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
    //     senderType: "seller",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "order_cancel_request_by_seller",
    //     },
    //   }
    // );

    // await NotificationService.sendNotification(
    //   "SELLER_REQUESTED_FOR_ORDER_CANCEL_FOR_SELLER",
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
    //     senderType: "seller",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "order_cancel_request_by_seller",
    //     },
    //   }
    // );

    return res.status(200).json({
      hasError: false,
      message: "Order cancel requested successfully.",
      data: updatedQuote,
    });
  } catch (error) {
    console.error("Error cancelling order request:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default requestForOrderCancelBySeller;
