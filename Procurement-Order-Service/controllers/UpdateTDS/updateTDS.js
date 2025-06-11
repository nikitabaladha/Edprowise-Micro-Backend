import OrderDetailsFromSeller from "../../models/OrderDetailsFromSeller.js";

import {
  getQuoteProposalBySellerIdEnqNoQuoteNo,
  fetchSubmitQuoteBySellerIdAndEnqNo,
  updateQuoteProposal,
} from "../AxiosRequestService/quoteProposalServiceRequest.js";

import { getAllEdprowiseAdmins } from "../AxiosRequestService/userServiceRequest.js";

// import { NotificationService } from "../../../notificationService.js";

async function updateTDS(req, res) {
  try {
    const { enquiryNumber, quoteNumber, sellerId } = req.query;
    const { tDSAmount } = req.body;

    if (!enquiryNumber || !quoteNumber || !sellerId) {
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumber, quoteNumber, and sellerId are required",
      });
    }

    const quoteProposalRes = await getQuoteProposalBySellerIdEnqNoQuoteNo(
      enquiryNumber,
      quoteNumber,
      sellerId
    );

    if (quoteProposalRes.hasError || !quoteProposalRes.data) {
      return res.status(404).json({
        hasError: true,
        message:
          "No Quote Proposal found for the given enquiryNumber, quoteNumber, and sellerId.",
        error: quoteProposalRes.error,
      });
    }

    const existingQuoteProposal = quoteProposalRes.data;

    const submitQuoteRes = await fetchSubmitQuoteBySellerIdAndEnqNo(
      sellerId,
      enquiryNumber
    );

    if (submitQuoteRes.hasError || !submitQuoteRes.data) {
      return res.status(404).json({
        hasError: true,
        message:
          "No Submit Quote found for the given enquiryNumber and sellerId.",
        error: submitQuoteRes.error,
      });
    }

    const existingSubmitQuote = submitQuoteRes.data;

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

    const tdsValue =
      existingQuoteProposal.totalTaxableValue * (tDSAmount / 100);

    const tdsValueForEdprowise =
      existingQuoteProposal.totalTaxableValueForEdprowise * (tDSAmount / 100);

    const finalPayableAmountWithTDS =
      existingQuoteProposal.totalAmount -
      existingSubmitQuote.advanceRequiredAmount -
      tdsValue;

    const finalPayableAmountWithTDSForEdprowise =
      existingQuoteProposal.totalAmountForEdprowise -
      existingSubmitQuote.advanceRequiredAmount -
      tdsValueForEdprowise;

    const updateResponse = await updateQuoteProposal(enquiryNumber, sellerId, {
      tDSAmount,
      tdsValue,
      tdsValueForEdprowise,
      finalPayableAmountWithTDS,
      finalPayableAmountWithTDSForEdprowise,
    });

    if (updateResponse.hasError || !updateResponse.data) {
      return res.status(500).json({
        hasError: true,
        message: "Failed to update quote proposal via service.",
        error: updateResponse.error,
      });
    }

    const updatedQuoteProposal = updateResponse.data;

    const senderId = req.user.id;

    const adminsRes = await getAllEdprowiseAdmins();
    const relevantEdprowise = adminsRes?.data || [];

    // await NotificationService.sendNotification(
    //   "EDPROWISE_TDS_UPDATED",
    //   relevantEdprowise.map((admin) => ({
    //     id: admin._id.toString(),
    //     type: "edprowise",
    //   })),
    //   {
    //     orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //     enquiryNumber: existingOrderDetailsFromSeller.enquiryNumber,
    //     entityId: updatedQuoteProposal._id,
    //     entityType: "TDS Update",
    //     senderType: "edprowise",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "tds_updated_by_edprowise",
    //     },
    //   }
    // );

    // await NotificationService.sendNotification(
    //   "SCHOOL_TDS_UPDATED",
    //   [
    //     {
    //       id: existingOrderDetailsFromSeller.schoolId.toString(),
    //       type: "school",
    //     },
    //   ],
    //   {
    //     orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //     enquiryNumber: existingOrderDetailsFromSeller.enquiryNumber,
    //     entityId: updatedQuoteProposal._id,
    //     entityType: "TDS Update",
    //     senderType: "edprowise",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "tds_updated_by_edprowise",
    //     },
    //   }
    // );

    // await NotificationService.sendNotification(
    //   "SELLER_TDS_UPDATED",
    //   [
    //     {
    //       id: existingOrderDetailsFromSeller.sellerId.toString(),
    //       type: "seller",
    //     },
    //   ],
    //   {
    //     orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //     enquiryNumber: existingOrderDetailsFromSeller.enquiryNumber,
    //     entityId: updatedQuoteProposal._id,
    //     entityType: "TDS Update",
    //     senderType: "edprowise",
    //     senderId: senderId,
    //     metadata: {
    //       orderNumber: existingOrderDetailsFromSeller.orderNumber,
    //       type: "tds_updated_by_edprowise",
    //     },
    //   }
    // );

    return res.status(200).json({
      hasError: false,
      message: "TDS amount updated successfully.",
      data: updatedQuoteProposal,
    });
  } catch (error) {
    console.error("Error updating TDS amount:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default updateTDS;
