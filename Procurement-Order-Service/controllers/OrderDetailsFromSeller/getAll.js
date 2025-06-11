import OrderDetailsFromSeller from "../../models/OrderDetailsFromSeller.js";
import {
  fetchQuoteProposalBySellerIdsAndEnqNos,
  fetchSubmitQuoteBySellerIdsAndEnqNos,
  fetchPrepareQuoteBySellerIdsAndEnqNos,
} from "../AxiosRequestService/quoteProposalServiceRequest.js";

import { getRequiredFieldsBySellerIds } from "../AxiosRequestService/userServiceRequest.js";

import { fetchQuoteRequestByEnqNos } from "../AxiosRequestService/quoteRequestServiceRequest.js";

async function getAll(req, res) {
  try {
    // 1. Fetch orders
    const orders = await OrderDetailsFromSeller.find()
      .sort({ createdAt: -1 })
      .select(
        "orderNumber quoteNumber createdAt actualDeliveryDate otherCharges enquiryNumber sellerId schoolId"
      )
      .lean();

    if (!orders.length) {
      return res.status(404).json({
        hasError: true,
        message: "No order details found.",
      });
    }

    // 2. Unique sellerIds & enquiryNumbers
    const sellerIds = [...new Set(orders.map((order) => order.sellerId))];
    const enquiryNumbers = [
      ...new Set(orders.map((order) => order.enquiryNumber)),
    ];

    // 3. Field selections (comma-separated format)
    const quoteProposalFields = `
      enquiryNumber,sellerId,totalAmountBeforeGstAndDiscount,totalAmount,cancelReasonFromBuyer,
      cancelReasonFromSeller,totalTaxableValue,totalTaxAmount,tdsValue,finalPayableAmountWithTDS,
      tDSAmount,supplierStatus,edprowiseStatus,buyerStatus,totalTaxableValueForEdprowise,
      totalAmountForEdprowise,totalTaxAmountForEdprowise,tdsValueForEdprowise,
      finalPayableAmountWithTDSForEdprowise,orderStatus
    `.replace(/\s+/g, "");

    const submitQuoteFields = `
      enquiryNumber,sellerId,advanceRequiredAmount,deliveryCharges
    `.replace(/\s+/g, "");

    const prepareQuoteFields = `
      enquiryNumber,sellerId,cgstRate,sgstRate,igstRate,cgstRateForEdprowise,
      sgstRateForEdprowise,igstRateForEdprowise
    `.replace(/\s+/g, "");

    const QuoteRequestFields = `enquiryNumber,expectedDeliveryDate`;

    const sellerProfileFields = `sellerId,companyName`;

    // 4. Fetch related data
    const [
      sellerProfilesresponse,
      quoteRequestsResponse,
      quoteProposalsResponse,
      submitQuotesResponse,
      prepareQuotesResponse,
    ] = await Promise.all([
      getRequiredFieldsBySellerIds(sellerIds, sellerProfileFields),
      fetchQuoteRequestByEnqNos(enquiryNumbers, QuoteRequestFields),
      fetchQuoteProposalBySellerIdsAndEnqNos(
        sellerIds,
        enquiryNumbers,
        quoteProposalFields
      ),
      fetchSubmitQuoteBySellerIdsAndEnqNos(
        sellerIds,
        enquiryNumbers,
        submitQuoteFields
      ),
      fetchPrepareQuoteBySellerIdsAndEnqNos(
        sellerIds,
        enquiryNumbers,
        prepareQuoteFields
      ),
    ]);

    // 5. Handle errors
    if (
      sellerProfilesresponse.hasError ||
      quoteProposalsResponse.hasError ||
      submitQuotesResponse.hasError ||
      prepareQuotesResponse.hasError ||
      quoteRequestsResponse.hasError
    ) {
      return res.status(500).json({
        hasError: true,
        message: "Failed to fetch quote-related data",
        error: {
          sellerProfiles: sellerProfilesresponse.error,
          quoteProposals: quoteProposalsResponse.error,
          submitQuotes: submitQuotesResponse.error,
          prepareQuotes: prepareQuotesResponse.error,
          quoteRequests: quoteRequestsResponse.error,
        },
      });
    }

    const sellerProfiles = sellerProfilesresponse.data;

    // 6. Build maps
    const sellerMap = Object.fromEntries(
      sellerProfiles.map((seller) => [
        seller.sellerId.toString(),
        seller.companyName,
      ])
    );

    const quoteRequestMap = Object.fromEntries(
      quoteRequestsResponse.data.map((q) => [q.enquiryNumber, q])
    );

    const quoteProposalMap = Object.fromEntries(
      quoteProposalsResponse.data.map((qp) => [
        `${qp.enquiryNumber}_${qp.sellerId}`,
        qp,
      ])
    );

    const submitQuoteMap = Object.fromEntries(
      submitQuotesResponse.data.map((sq) => [
        `${sq.enquiryNumber}_${sq.sellerId}`,
        sq,
      ])
    );

    const prepareQuoteMap = Object.fromEntries(
      prepareQuotesResponse.data.map((pq) => [
        `${pq.enquiryNumber}_${pq.sellerId}`,
        pq,
      ])
    );

    // 7. Enrich orders
    const enrichedOrders = orders.map((order) => {
      const compositeKey = `${order.enquiryNumber}_${order.sellerId}`;
      const quoteProposal = quoteProposalMap[compositeKey] || {};
      const submitQuote = submitQuoteMap[compositeKey] || {};
      const prepareQuote = prepareQuoteMap[compositeKey] || {};

      return {
        ...order,
        companyName: sellerMap[order.sellerId?.toString()] || null,
        expectedDeliveryDate:
          quoteRequestMap[order.enquiryNumber]?.expectedDeliveryDate || null,
        supplierStatus: quoteProposal.supplierStatus || null,
        buyerStatus: quoteProposal.buyerStatus || null,
        orderStatus: quoteProposal.orderStatus || null,
        edprowiseStatus: quoteProposal.edprowiseStatus || null,
        totalAmountBeforeGstAndDiscount:
          quoteProposal.totalAmountBeforeGstAndDiscount || null,
        totalAmount: quoteProposal.totalAmount || null,
        totalAmountForEdprowise: quoteProposal.totalAmountForEdprowise || null,
        totalTaxableValue: quoteProposal.totalTaxableValue || null,
        totalTaxableValueForEdprowise:
          quoteProposal.totalTaxableValueForEdprowise || null,
        totalGstAmount: quoteProposal.totalTaxAmount || null,
        totalGstAmountForEdprowise:
          quoteProposal.totalTaxAmountForEdprowise || null,
        advanceAdjustment: submitQuote.advanceRequiredAmount || 0,
        deliveryCharges: submitQuote.deliveryCharges || 0,
        finalPayableAmountWithTDS: quoteProposal.finalPayableAmountWithTDS || 0,
        finalPayableAmountWithTDSForEdprowise:
          quoteProposal.finalPayableAmountWithTDSForEdprowise || 0,
        tDSAmount: quoteProposal.tDSAmount || 0,
        tdsValue: quoteProposal.tdsValue || 0,
        tdsValueForEdprowise: quoteProposal.tdsValueForEdprowise || 0,
        cancelReasonFromBuyer: quoteProposal.cancelReasonFromBuyer || null,
        cancelReasonFromSeller: quoteProposal.cancelReasonFromSeller || null,
        cgstRate: prepareQuote.cgstRate || 0,
        sgstRate: prepareQuote.sgstRate || 0,
        igstRate: prepareQuote.igstRate || 0,
        cgstRateForEdprowise: prepareQuote.cgstRateForEdprowise || 0,
        sgstRateForEdprowise: prepareQuote.sgstRateForEdprowise || 0,
        igstRateForEdprowise: prepareQuote.igstRateForEdprowise || 0,
      };
    });

    // 8. Send response
    return res.status(200).json({
      message: "All order details retrieved successfully!",
      data: enrichedOrders,
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

export default getAll;
