import OrderDetailsFromSeller from "../../models/OrderDetailsFromSeller.js";

import { getQuoteRequestByEnquiryNumber } from "../AxiosRequestService/quoteRequestServiceRequest.js";
import {
  getQuoteProposalBySellerIdEnqNoQuoteNo,
  fetchPrepareQuoteBySellerIdAndEnqNo,
  fetchSubmitQuoteBySellerIdAndEnqNo,
} from "../AxiosRequestService/quoteProposalServiceRequest.js";
import { getSellerById } from "../AxiosRequestService/userServiceRequest.js";

async function getAllBySchoolId(req, res) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      hasError: true,
      message: "School ID is required.",
    });
  }

  try {
    const orderDetails = await OrderDetailsFromSeller.find({ schoolId: id })
      .sort({ createdAt: -1 })
      .select(
        "_id orderNumber quoteNumber createdAt actualDeliveryDate enquiryNumber sellerId schoolId"
      )
      .lean();

    if (!orderDetails.length) {
      return res.status(404).json({
        hasError: true,
        message: "No order details found for the given School ID.",
      });
    }

    const enrichedOrders = await Promise.all(
      orderDetails.map(async (order) => {
        const { enquiryNumber, sellerId, quoteNumber } = order;

        // Field strings
        const quoteRequestFields = "expectedDeliveryDate";
        const quoteProposalFields = `
          totalAmountBeforeGstAndDiscount,
          totalAmount,
          totalTaxableValue,
          totalTaxAmount,
          finalPayableAmountWithTDS,
          tDSAmount,
          tdsValue,
          supplierStatus,
          edprowiseStatus,
          buyerStatus,
          updatedAt,
          rating,
          feedbackComment
        `;
        const submitQuoteFields = `
          advanceRequiredAmount,
          deliveryCharges
        `;
        const prepareQuoteFields = `
          cgstRate,
          sgstRate,
          igstRate
        `;
        const sellerFields = "companyName";

        // Parallel API calls
        const [
          quoteRequestRes,
          quoteProposalRes,
          submitQuoteRes,
          sellerProfileRes,
          prepareQuoteRes,
        ] = await Promise.all([
          getQuoteRequestByEnquiryNumber(enquiryNumber, quoteRequestFields),
          getQuoteProposalBySellerIdEnqNoQuoteNo(
            enquiryNumber,
            quoteNumber,
            sellerId,
            quoteProposalFields
          ),
          fetchSubmitQuoteBySellerIdAndEnqNo(
            sellerId,
            enquiryNumber,
            submitQuoteFields
          ),
          getSellerById(sellerId, sellerFields),
          fetchPrepareQuoteBySellerIdAndEnqNo(
            sellerId,
            enquiryNumber,
            prepareQuoteFields
          ),
        ]);

        const quoteRequest = quoteRequestRes.data || {};
        const quoteProposals = quoteProposalRes.data || {};
        const submitQuote = submitQuoteRes.data || {};
        const sellerProfile = sellerProfileRes.data || {};
        const prepareQuote = prepareQuoteRes.data || {};

        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          enquiryNumber: order.enquiryNumber,
          quoteNumber: order.quoteNumber,
          sellerId: order.sellerId,
          schoolId: order.schoolId,
          actualDeliveryDate: order.actualDeliveryDate || null,
          otherCharges: order.otherCharges || 0,
          createdAt: order.createdAt,
          expectedDeliveryDate: quoteRequest?.expectedDeliveryDate || null,
          supplierStatus: quoteProposals?.supplierStatus || null,
          buyerStatus: quoteProposals?.buyerStatus || null,
          edprowiseStatus: quoteProposals?.edprowiseStatus || null,
          totalAmountBeforeGstAndDiscount:
            quoteProposals?.totalAmountBeforeGstAndDiscount || 0,
          totalAmount: quoteProposals?.totalAmount || 0,
          totalTaxableValue: quoteProposals?.totalTaxableValue || 0,
          totalGstAmount: quoteProposals?.totalTaxAmount || 0,
          tdsValue: quoteProposals?.tdsValue || 0,
          finalPayableAmountWithTDS:
            quoteProposals?.finalPayableAmountWithTDS || 0,
          tDSAmount: quoteProposals?.tDSAmount || 0,
          updatedAt: quoteProposals?.updatedAt,
          rating: quoteProposals?.rating || 0,
          feedbackComment: quoteProposals?.feedbackComment || null,
          advanceAdjustment: submitQuote?.advanceRequiredAmount || 0,
          deliveryCharges: submitQuote?.deliveryCharges || 0,
          companyName: sellerProfile?.companyName || "Not Available",
          cgstRate: prepareQuote?.cgstRate || 0,
          sgstRate: prepareQuote?.sgstRate || 0,
          igstRate: prepareQuote?.igstRate || 0,
        };
      })
    );

    return res.status(200).json({
      message: "Order details retrieved successfully!",
      data: enrichedOrders,
      hasError: false,
    });
  } catch (error) {
    console.error("Error retrieving Order details:", error);
    return res.status(500).json({
      message: "Failed to retrieve Order Details.",
      error: error.message,
    });
  }
}

export default getAllBySchoolId;
