import OrderDetailsFromSeller from "../../models/OrderDetailsFromSeller.js";

import { getQuoteRequestByEnquiryNumber } from "../AxiosRequestService/quoteRequestServiceRequest.js";
import {
  getQuoteProposal,
  fetchPrepareQuoteBySellerIdAndEnqNo,
  fetchSubmitQuoteBySellerIdAndEnqNo,
} from "../AxiosRequestService/quoteProposalServiceRequest.js";
import { getSellerById } from "../AxiosRequestService/userServiceRequest.js";

async function getOneByOrderNumber(req, res) {
  const { orderNumber } = req.params;

  if (!orderNumber) {
    return res.status(400).json({
      hasError: true,
      message: "OrderNumber is required.",
    });
  }

  try {
    // Step 1: Get order details
    const orderDetails = await OrderDetailsFromSeller.findOne({ orderNumber })
      .select(
        "orderNumber createdAt actualDeliveryDate enquiryNumber sellerId schoolId invoiceForSchool invoiceForEdprowise"
      )
      .lean();

    if (!orderDetails) {
      return res.status(404).json({
        hasError: true,
        message: "No order details found for the given order number.",
      });
    }

    const { enquiryNumber, sellerId } = orderDetails;

    // Step 2: Use service call to get seller profile
    const sellerProfileRes = await getSellerById(sellerId, "companyName");
    const companyName = sellerProfileRes?.data?.companyName || null;

    // Step 3: Call other microservices in parallel using Axios service functions
    const [quoteRequestRes, quoteProposalRes, prepareQuoteRes, submitQuoteRes] =
      await Promise.all([
        getQuoteRequestByEnquiryNumber(enquiryNumber, "expectedDeliveryDate"),
        getQuoteProposal(
          enquiryNumber,
          sellerId,
          [
            "totalAmountBeforeGstAndDiscount",
            "totalAmount",
            "orderStatus",
            "totalTaxableValue",
            "totalTaxAmount",
            "finalPayableAmountWithTDS",
            "tDSAmount",
            "tdsValue",
            "supplierStatus",
            "edprowiseStatus",
            "buyerStatus",
            "totalTaxableValueForEdprowise",
            "totalAmountForEdprowise",
            "totalTaxAmountForEdprowise",
            "tdsValueForEdprowise",
            "finalPayableAmountWithTDSForEdprowise",
            "rating",
            "feedbackComment",
          ].join(",")
        ),
        fetchPrepareQuoteBySellerIdAndEnqNo(
          sellerId,
          enquiryNumber,
          [
            "cgstRate",
            "sgstRate",
            "igstRate",
            "cgstRateForEdprowise",
            "sgstRateForEdprowise",
            "igstRateForEdprowise",
          ].join(",")
        ),
        fetchSubmitQuoteBySellerIdAndEnqNo(
          sellerId,
          enquiryNumber,
          ["advanceRequiredAmount", "deliveryCharges"].join(",")
        ),
      ]);

    const quoteRequest = quoteRequestRes?.data || {};
    const quoteProposal = quoteProposalRes?.data || {};
    const prepareQuote = prepareQuoteRes?.data || {};
    const submitQuote = submitQuoteRes?.data || {};

    // Step 4: Construct final response object
    const enrichedOrder = {
      ...orderDetails,
      companyName,
      expectedDeliveryDate: quoteRequest?.expectedDeliveryDate || null,
      supplierStatus: quoteProposal?.supplierStatus || null,
      buyerStatus: quoteProposal?.buyerStatus || null,
      orderStatus: quoteProposal?.orderStatus || null,
      edprowiseStatus: quoteProposal?.edprowiseStatus || null,
      totalAmountBeforeGstAndDiscount:
        quoteProposal?.totalAmountBeforeGstAndDiscount || null,
      totalAmount: quoteProposal?.totalAmount || null,
      totalAmountForEdprowise: quoteProposal?.totalAmountForEdprowise || 0,
      totalTaxableValue: quoteProposal?.totalTaxableValue || null,
      totalGstAmount: quoteProposal?.totalTaxAmount || null,
      feedbackComment: quoteProposal?.feedbackComment || null,
      rating: quoteProposal?.rating || 0,
      totalGstAmountForEdprowise:
        quoteProposal?.totalTaxAmountForEdprowise || 0,
      totalTaxableValueForEdprowise:
        quoteProposal?.totalTaxableValueForEdprowise || 0,
      advanceAdjustment: submitQuote?.advanceRequiredAmount || 0,
      deliveryCharges: submitQuote?.deliveryCharges || 0,
      tdsValue: quoteProposal?.tdsValue || 0,
      tdsValueForEdprowise: quoteProposal?.tdsValueForEdprowise || 0,
      finalPayableAmountWithTDS: quoteProposal?.finalPayableAmountWithTDS || 0,
      finalPayableAmountWithTDSForEdprowise:
        quoteProposal?.finalPayableAmountWithTDSForEdprowise || 0,
      tDSAmount: quoteProposal?.tDSAmount || 0,
      cgstRate: prepareQuote?.cgstRate || 0,
      sgstRate: prepareQuote?.sgstRate || 0,
      igstRate: prepareQuote?.igstRate || 0,
      cgstRateForEdprowise: prepareQuote?.cgstRateForEdprowise || 0,
      sgstRateForEdprowise: prepareQuote?.sgstRateForEdprowise || 0,
      igstRateForEdprowise: prepareQuote?.igstRateForEdprowise || 0,
    };

    return res.status(200).json({
      message: "Order details retrieved successfully!",
      data: enrichedOrder,
      hasError: false,
    });
  } catch (error) {
    console.error("Error retrieving Order details:", error);
    return res.status(500).json({
      message: "Failed to retrieve Order Details.",
      error: error.message,
      hasError: true,
    });
  }
}

export default getOneByOrderNumber;
