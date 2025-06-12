import OrderDetailsFromSeller from "../../models/OrderDetailsFromSeller.js";

import { getQuoteRequestByEnquiryNumber } from "../AxiosRequestService/quoteRequestServiceRequest.js";
import {
  getQuoteProposalBySellerIdEnqNoQuoteNo,
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
    // Get order details
    const orderDetails = await OrderDetailsFromSeller.findOne({ orderNumber })
      .select(
        "_id orderNumber quoteNumber createdAt actualDeliveryDate enquiryNumber sellerId schoolId invoiceForSchool invoiceForEdprowise"
      )
      .lean();

    if (!orderDetails) {
      return res.status(404).json({
        hasError: true,
        message: "No order details found for the given order number.",
      });
    }

    const { enquiryNumber, sellerId, quoteNumber } = orderDetails;

    // Field strings
    const quoteRequestFields = "expectedDeliveryDate";
    const quoteProposalFields = `
      totalAmountBeforeGstAndDiscount,
      totalAmount,
      orderStatus,
      totalTaxableValue,
      totalTaxAmount,
      tDSAmount,
      tdsValue,
      supplierStatus,
      edprowiseStatus,
      buyerStatus,
      totalTaxableValueForEdprowise,
      totalAmountForEdprowise,
      totalTaxAmountForEdprowise,
      tdsValueForEdprowise,
      finalPayableAmountWithTDS,
      finalPayableAmountWithTDSForEdprowise,
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
      igstRate,
      cgstRateForEdprowise,
      sgstRateForEdprowise,
      igstRateForEdprowise
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

    console.log("Quote Proposal Response:", quoteProposals);

    const enrichedOrder = {
      _id: orderDetails._id,
      orderNumber: orderDetails.orderNumber,
      enquiryNumber: orderDetails.enquiryNumber,
      quoteNumber: orderDetails.quoteNumber,
      sellerId: orderDetails.sellerId,
      schoolId: orderDetails.schoolId,
      actualDeliveryDate: orderDetails.actualDeliveryDate || null,
      createdAt: orderDetails.createdAt,
      invoiceForSchool: orderDetails.invoiceForSchool,
      invoiceForEdprowise: orderDetails.invoiceForEdprowise,
      expectedDeliveryDate: quoteRequest?.expectedDeliveryDate || null,
      supplierStatus: quoteProposals?.supplierStatus || null,
      buyerStatus: quoteProposals?.buyerStatus || null,
      orderStatus: quoteProposals?.orderStatus || null,
      edprowiseStatus: quoteProposals?.edprowiseStatus || null,
      totalAmountBeforeGstAndDiscount:
        quoteProposals?.totalAmountBeforeGstAndDiscount || 0,
      totalAmount: quoteProposals?.totalAmount || 0,
      totalAmountForEdprowise: quoteProposals?.totalAmountForEdprowise || 0,
      totalTaxableValue: quoteProposals?.totalTaxableValue || 0,
      totalGstAmount: quoteProposals?.totalTaxAmount || 0,
      totalGstAmountForEdprowise:
        quoteProposals?.totalTaxAmountForEdprowise || 0,
      totalTaxableValueForEdprowise:
        quoteProposals?.totalTaxableValueForEdprowise || 0,
      tdsValue: quoteProposals?.tdsValue || 0,
      tdsValueForEdprowise: quoteProposals?.tdsValueForEdprowise || 0,
      finalPayableAmountWithTDS: quoteProposals?.finalPayableAmountWithTDS || 0,
      finalPayableAmountWithTDSForEdprowise:
        quoteProposals?.finalPayableAmountWithTDSForEdprowise || 0,
      tDSAmount: quoteProposals?.tDSAmount || 0,
      rating: quoteProposals?.rating || 0,
      feedbackComment: quoteProposals?.feedbackComment || null,
      advanceAdjustment: submitQuote?.advanceRequiredAmount || 0,
      deliveryCharges: submitQuote?.deliveryCharges || 0,
      companyName: sellerProfile?.companyName || "Not Available",
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
