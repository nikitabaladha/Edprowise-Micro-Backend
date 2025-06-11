import OrderDetailsFromSeller from "../../models/OrderDetailsFromSeller.js";
import { getQuoteRequestByEnquiryNumber } from "../AxiosRequestService/quoteRequestServiceRequest.js";
import {
  getQuoteProposal,
  fetchPrepareQuoteBySellerIdAndEnqNo,
  fetchSubmitQuoteBySellerIdAndEnqNo,
} from "../AxiosRequestService/quoteProposalServiceRequest.js";
import { getSellerById } from "../AxiosRequestService/userServiceRequest.js";

async function getAllBySellerId(req, res) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      hasError: true,
      message: "Seller ID is required.",
    });
  }

  try {
    const orderDetails = await OrderDetailsFromSeller.find({ sellerId: id })
      .select(
        "orderNumber createdAt actualDeliveryDate enquiryNumber sellerId schoolId invoiceForSchool invoiceForEdprowise"
      )
      .sort({ createdAt: -1 })
      .lean();

    if (!orderDetails.length) {
      return res.status(404).json({
        hasError: true,
        message: "No order details found for the given seller ID.",
      });
    }

    // Fetch company name from Seller Service
    const sellerProfileResponse = await getSellerById(id, "companyName");
    const companyName = sellerProfileResponse?.data?.companyName || null;

    const enrichedOrders = await Promise.all(
      orderDetails.map(async (order) => {
        const { enquiryNumber } = order;

        // Fetch quote request
        const quoteRequestResponse = await getQuoteRequestByEnquiryNumber(
          enquiryNumber,
          "expectedDeliveryDate"
        );
        const quoteRequest = quoteRequestResponse?.data || {};

        // Fetch quote proposal
        const quoteProposalResponse = await getQuoteProposal(
          enquiryNumber,
          id,
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
          ]
        );
        const quoteProposal = quoteProposalResponse?.data || {};

        // Fetch prepare quote
        const prepareQuoteResponse = await fetchPrepareQuoteBySellerIdAndEnqNo(
          id,
          enquiryNumber,
          [
            "cgstRate",
            "sgstRate",
            "igstRate",
            "cgstRateForEdprowise",
            "sgstRateForEdprowise",
            "igstRateForEdprowise",
          ]
        );
        const prepareQuote = prepareQuoteResponse?.data || {};

        // Fetch submit quote
        const submitQuoteResponse = await fetchSubmitQuoteBySellerIdAndEnqNo(
          id,
          enquiryNumber,
          ["advanceRequiredAmount", "deliveryCharges"]
        );
        const submitQuote = submitQuoteResponse?.data || {};

        return {
          ...order,
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
          totalGstAmountForEdprowise:
            quoteProposal?.totalTaxAmountForEdprowise || 0,
          totalTaxableValueForEdprowise:
            quoteProposal?.totalTaxableValueForEdprowise || 0,
          advanceAdjustment: submitQuote?.advanceRequiredAmount || 0,
          tdsValue: quoteProposal?.tdsValue || 0,
          tdsValueForEdprowise: quoteProposal?.tdsValueForEdprowise || 0,
          finalPayableAmountWithTDS:
            quoteProposal?.finalPayableAmountWithTDS || 0,
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

export default getAllBySellerId;
