import PrepareQuote from "../../models/PrepareQuote.js";
import PrepareQuoteValidator from "../../validators/PrepareQuote.js";
import QuoteProposal from "../../models/QuoteProposal.js";
import SubmitQuote from "../../models/SubmitQuote.js";
import QuoteRequest from "../../models/QuoteRequest.js";

import axios from "axios";

// import SellerProfile from "../../../models/SellerProfile.js";
// import EdprowiseProfile from "../../../models/EdprowiseProfile.js";
// import School from "../../../models/School.js";
// import AdminUser from "../../../models/AdminUser.js";
// import { NotificationService } from "../../../notificationService.js";

async function updateSingleProduct(req, res) {
  try {
    const { sellerId, enquiryNumber, id } = req.query;
    const productData = req.body;

    if (!sellerId || !enquiryNumber || !id) {
      return res.status(400).json({
        hasError: true,
        message: "Seller ID, enquiry number, and product ID are required.",
      });
    }

    // Validate the product data
    const { error } =
      PrepareQuoteValidator.prepareQuoteUpdate.validate(productData);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

    // Find the existing PrepareQuote
    const existingQuote = await PrepareQuote.findOne({
      sellerId,
      enquiryNumber,
      _id: id,
    });

    if (!existingQuote) {
      return res.status(404).json({
        hasError: true,
        message: `No PrepareQuote found with ID ${id} for enquiry number ${enquiryNumber} and seller ID ${sellerId}.`,
      });
    }

    // Check if the update is allowed within 4 hours of creation
    const createdAt = existingQuote.createdAt;
    const currentTime = new Date();
    const timeDifference = currentTime - createdAt;
    const fourHoursInMilliseconds = 4 * 60 * 60 * 1000;

    if (timeDifference > fourHoursInMilliseconds) {
      return res.status(403).json({
        hasError: true,
        message: "Update not allowed after 4 hours from creation time.",
      });
    }

    const [quoteRequest, sellerResponse, edprowiseResponse] = await Promise.all(
      [
        // Local query
        QuoteRequest.findOne({ enquiryNumber }),

        // User-Service calls
        axios
          .get(
            `${process.env.USER_SERVICE_URL}/api/required-field-from-seller-profile/${sellerId}`
          )
          .catch(() => ({ data: { data: null } })),

        axios
          .get(
            `${process.env.USER_SERVICE_URL}/api/required-field-from-edprowise-profile`
          )
          .catch(() => ({ data: { data: null } })),
      ]
    );

    const sellerProfile = sellerResponse.data.data;
    const edprowiseProfile = edprowiseResponse.data.data;

    if (!quoteRequest || !sellerProfile || !edprowiseProfile) {
      return res.status(404).json({
        hasError: true,
        message: "Required profile data not found.",
      });
    }

    // Extract states from location strings
    const schoolState = quoteRequest.deliveryState;
    const sellerState = sellerProfile.state;
    const edprowiseState = edprowiseProfile.state;

    if (!schoolState || !sellerState || !edprowiseState) {
      return res.status(400).json({
        hasError: true,
        message: "Location data is incomplete.",
      });
    }

    // Update fields if new data is provided, otherwise retain existing values
    existingQuote.subcategoryName =
      productData.subcategoryName || existingQuote.subcategoryName;
    existingQuote.hsnSacc = productData.hsnSacc || existingQuote.hsnSacc;
    existingQuote.listingRate =
      productData.listingRate !== undefined
        ? parseFloat(productData.listingRate)
        : existingQuote.listingRate;
    existingQuote.edprowiseMargin =
      productData.edprowiseMargin !== undefined
        ? parseFloat(productData.edprowiseMargin)
        : existingQuote.edprowiseMargin;
    existingQuote.quantity =
      productData.quantity !== undefined
        ? parseFloat(productData.quantity)
        : existingQuote.quantity;
    existingQuote.discount =
      productData.discount !== undefined
        ? parseFloat(productData.discount)
        : existingQuote.discount;

    // Update GST rates
    const cgstRate =
      productData.cgstRate !== undefined
        ? parseFloat(productData.cgstRate)
        : existingQuote.cgstRate;
    const sgstRate =
      productData.sgstRate !== undefined
        ? parseFloat(productData.sgstRate)
        : existingQuote.sgstRate;
    const igstRate =
      productData.igstRate !== undefined
        ? parseFloat(productData.igstRate)
        : existingQuote.igstRate;

    existingQuote.cgstRate = cgstRate;
    existingQuote.sgstRate = sgstRate;
    existingQuote.igstRate = igstRate;

    // Calculate GST rates for Edprowise based on location scenarios
    let cgstRateForEdprowise = 0;
    let sgstRateForEdprowise = 0;
    let igstRateForEdprowise = 0;

    // Scenario 1: All locations match
    if (schoolState === edprowiseState && edprowiseState === sellerState) {
      cgstRateForEdprowise = cgstRate;
      sgstRateForEdprowise = sgstRate;
      igstRateForEdprowise = igstRate;
    }
    // Scenario 2: School ≠ Edprowise = Seller
    else if (schoolState !== edprowiseState && edprowiseState === sellerState) {
      cgstRateForEdprowise = igstRate / 2;
      sgstRateForEdprowise = igstRate / 2;
      igstRateForEdprowise = 0;
    }
    // Scenario 3: All locations different
    else if (schoolState !== edprowiseState && edprowiseState !== sellerState) {
      cgstRateForEdprowise = 0;
      sgstRateForEdprowise = 0;
      igstRateForEdprowise = igstRate;
    }
    // Scenario 4: School = Edprowise ≠ Seller
    else if (schoolState === edprowiseState && edprowiseState !== sellerState) {
      cgstRateForEdprowise = 0;
      sgstRateForEdprowise = 0;
      igstRateForEdprowise = cgstRate + sgstRate;
    }

    existingQuote.cgstRateForEdprowise = cgstRateForEdprowise;
    existingQuote.sgstRateForEdprowise = sgstRateForEdprowise;
    existingQuote.igstRateForEdprowise = igstRateForEdprowise;

    // Perform calculations with updated or existing values
    const listingRate = existingQuote.listingRate;
    const edprowiseMargin = existingQuote.edprowiseMargin;
    const quantity = existingQuote.quantity;
    const discount = existingQuote.discount;

    // Recalculate fields
    const finalRateBeforeDiscount =
      listingRate + (listingRate * edprowiseMargin) / 100;
    const finalRate =
      finalRateBeforeDiscount - (finalRateBeforeDiscount * discount) / 100;
    const finalRateForEdprowise = (finalRate / (edprowiseMargin + 100)) * 100;
    const taxableValue = finalRate * quantity;
    const taxableValueForEdprowise = finalRateForEdprowise * quantity;
    const cgstAmount = (taxableValue * cgstRate) / 100;
    const sgstAmount = (taxableValue * sgstRate) / 100;
    const igstAmount = (taxableValue * igstRate) / 100;
    const cgstAmountForEdprowise =
      (taxableValueForEdprowise * cgstRateForEdprowise) / 100;
    const sgstAmountForEdprowise =
      (taxableValueForEdprowise * sgstRateForEdprowise) / 100;
    const igstAmountForEdprowise =
      (taxableValueForEdprowise * igstRateForEdprowise) / 100;
    const amountBeforeGstAndDiscount = finalRateBeforeDiscount * quantity;
    const discountAmount = (amountBeforeGstAndDiscount * discount) / 100;
    const gstAmount = cgstAmount + sgstAmount + igstAmount;
    const gstAmountForEdprowise =
      cgstAmountForEdprowise + sgstAmountForEdprowise + igstAmountForEdprowise;
    const totalAmountForProduct =
      amountBeforeGstAndDiscount - discountAmount + gstAmount;
    const totalAmountForProductForEdprowise =
      taxableValueForEdprowise + gstAmountForEdprowise;

    // Update the existing PrepareQuote with all fields
    existingQuote.finalRateBeforeDiscount = finalRateBeforeDiscount;
    existingQuote.finalRate = finalRate;
    existingQuote.finalRateForEdprowise = finalRateForEdprowise;
    existingQuote.taxableValue = taxableValue;
    existingQuote.taxableValueForEdprowise = taxableValueForEdprowise;
    existingQuote.cgstAmount = cgstAmount;
    existingQuote.sgstAmount = sgstAmount;
    existingQuote.igstAmount = igstAmount;
    existingQuote.cgstAmountForEdprowise = cgstAmountForEdprowise;
    existingQuote.sgstAmountForEdprowise = sgstAmountForEdprowise;
    existingQuote.igstAmountForEdprowise = igstAmountForEdprowise;
    existingQuote.amountBeforeGstAndDiscount = amountBeforeGstAndDiscount;
    existingQuote.discountAmount = discountAmount;
    existingQuote.gstAmount = gstAmount;
    existingQuote.gstAmountForEdprowise = gstAmountForEdprowise;
    existingQuote.totalAmount = totalAmountForProduct;
    existingQuote.totalAmountForEdprowise = totalAmountForProductForEdprowise;
    existingQuote.updateCountBySeller += 1;

    await existingQuote.save();

    // Aggregate all PrepareQuotes for the seller and enquiry
    const allPrepareQuotes = await PrepareQuote.find({
      sellerId,
      enquiryNumber,
    });

    let totalQuantity = 0;
    let totalFinalRateBeforeDiscount = 0;
    let totalAmountBeforeGstAndDiscount = 0;
    let totalDiscountAmount = 0;
    let totalGstAmount = 0;
    let totalAmount = 0;
    let totalTaxableValue = 0;
    let totalCgstAmount = 0;
    let totalSgstAmount = 0;
    let totalIgstAmount = 0;
    let totalTaxAmount = 0;

    let totalFinalRateBeforeDiscountForEdprowise = 0;
    let totalTaxableValueForEdprowise = 0;
    let totalCgstAmountForEdprowise = 0;
    let totalSgstAmountForEdprowise = 0;
    let totalIgstAmountForEdprowise = 0;
    let totalTaxAmountForEdprowise = 0;
    let totalAmountForEdprowise = 0;

    allPrepareQuotes.forEach((quote) => {
      totalQuantity += quote.quantity;
      totalFinalRateBeforeDiscount += quote.finalRateBeforeDiscount;
      totalAmountBeforeGstAndDiscount += quote.amountBeforeGstAndDiscount;
      totalDiscountAmount += quote.discountAmount;
      totalGstAmount += quote.gstAmount;
      totalAmount += quote.totalAmount;
      totalTaxableValue += quote.taxableValue;
      totalCgstAmount += quote.cgstAmount;
      totalSgstAmount += quote.sgstAmount;
      totalIgstAmount += quote.igstAmount;
      totalTaxAmount += quote.gstAmount;

      totalFinalRateBeforeDiscountForEdprowise += quote.finalRateBeforeDiscount;
      totalTaxableValueForEdprowise += quote.taxableValueForEdprowise;
      totalCgstAmountForEdprowise += quote.cgstAmountForEdprowise;
      totalSgstAmountForEdprowise += quote.sgstAmountForEdprowise;
      totalIgstAmountForEdprowise += quote.igstAmountForEdprowise;
      totalTaxAmountForEdprowise += quote.gstAmountForEdprowise;
      totalAmountForEdprowise += quote.totalAmountForEdprowise;
    });

    // Find the existing QuoteProposal
    const existingQuoteProposal = await QuoteProposal.findOne({
      sellerId,
      enquiryNumber,
    });

    if (!existingQuoteProposal) {
      return res.status(404).json({
        hasError: true,
        message: `No QuoteProposal found for enquiry number ${enquiryNumber} and seller ID ${sellerId}.`,
      });
    }

    // Update QuoteProposal with aggregated values
    existingQuoteProposal.totalQuantity = totalQuantity;
    existingQuoteProposal.totalFinalRateBeforeDiscount =
      totalFinalRateBeforeDiscount;
    existingQuoteProposal.totalAmountBeforeGstAndDiscount =
      totalAmountBeforeGstAndDiscount;
    existingQuoteProposal.totalDiscountAmount = totalDiscountAmount;
    existingQuoteProposal.totalAmount = totalAmount;
    existingQuoteProposal.totalTaxableValue = totalTaxableValue;
    existingQuoteProposal.totalCgstAmount = totalCgstAmount;
    existingQuoteProposal.totalSgstAmount = totalSgstAmount;
    existingQuoteProposal.totalIgstAmount = totalIgstAmount;
    existingQuoteProposal.totalTaxAmount = totalTaxAmount;

    existingQuoteProposal.totalFinalRateBeforeDiscountForEdprowise =
      totalFinalRateBeforeDiscountForEdprowise;
    existingQuoteProposal.totalTaxableValueForEdprowise =
      totalTaxableValueForEdprowise;
    existingQuoteProposal.totalCgstAmountForEdprowise =
      totalCgstAmountForEdprowise;
    existingQuoteProposal.totalSgstAmountForEdprowise =
      totalSgstAmountForEdprowise;
    existingQuoteProposal.totalIgstAmountForEdprowise =
      totalIgstAmountForEdprowise;
    existingQuoteProposal.totalTaxAmountForEdprowise =
      totalTaxAmountForEdprowise;
    existingQuoteProposal.totalAmountForEdprowise = totalAmountForEdprowise;

    // Retrieve the current TDS amount from QuoteProposal
    const tDSAmount = existingQuoteProposal.tDSAmount || 0;

    // Calculate TDS value and final payable amount with TDS
    const tdsValue =
      existingQuoteProposal.totalTaxableValue * (tDSAmount / 100);

    const tdsValueForEdprowise =
      existingQuoteProposal.totalTaxableValueForEdprowise * (tDSAmount / 100);

    const existingSubmitted = await SubmitQuote.findOne({
      sellerId,
      enquiryNumber,
    });

    if (!existingSubmitted) {
      return res.status(404).json({
        hasError: true,
        message: `No Submitted Quote found for enquiry number ${enquiryNumber} and seller ID ${sellerId}.`,
      });
    }

    const finalPayableAmountWithTDS =
      existingQuoteProposal.totalAmount -
      existingSubmitted.advanceRequiredAmount -
      tdsValue;

    const finalPayableAmountWithTDSForEdprowise =
      existingQuoteProposal.totalAmountForEdprowise -
      existingSubmitted.advanceRequiredAmount -
      tdsValueForEdprowise;

    // Update QuoteProposal with TDS calculations
    existingQuoteProposal.tdsValue = tdsValue;
    existingQuoteProposal.tdsValueForEdprowise = tdsValueForEdprowise;

    existingQuoteProposal.finalPayableAmountWithTDS = finalPayableAmountWithTDS;
    existingQuoteProposal.finalPayableAmountWithTDSForEdprowise =
      finalPayableAmountWithTDSForEdprowise;

    // Save the updated QuoteProposal
    await existingQuoteProposal.save();

    // Update the quoted amount in SubmitQuote
    existingSubmitted.quotedAmount = totalAmount;
    await existingSubmitted.save();

    // await NotificationService.sendNotification(
    //   "SCHOOL_RECEIVED_UPDATED_QUOTE_FROM_SELLER",
    //   [{ id: quoteRequest.schoolId, type: "school" }],
    //   {
    //     companyName: sellerProfile.companyName,
    //     quoteNumber: existingQuoteProposal.quoteNumber,
    //     enquiryNumber: existingQuoteProposal.enquiryNumber,
    //     entityId: existingQuoteProposal._id,
    //     entityType: "QuoteProposal From Seller",
    //     senderType: "seller",
    //     senderId: sellerId,
    //     metadata: {
    //       enquiryNumber,
    //       sellerId: sellerId,
    //       type: "quote_updated_from_seller",
    //     },
    //   }
    // );
    // const schoolId = quoteRequest.schoolId;

    // const schoolProfile = await School.findOne({ schoolId });

    // await NotificationService.sendNotification(
    //   "SELLER_RECEIVED_UPDATED_QUOTE_BY_OWN",
    //   [{ id: sellerId, type: "seller" }],
    //   {
    //     schoolName: schoolProfile.schoolName,
    //     quoteNumber: existingQuoteProposal.quoteNumber,
    //     enquiryNumber: existingQuoteProposal.enquiryNumber,
    //     entityId: existingQuoteProposal._id,
    //     entityType: "QuoteProposal",
    //     senderType: "seller",
    //     senderId: sellerId,
    //     metadata: {
    //       enquiryNumber,
    //       type: "quote_updated_from_seller",
    //     },
    //   }
    // );

    // const relevantEdprowise = await AdminUser.find({});

    // await NotificationService.sendNotification(
    //   "EDPROWISE_RECEIVED_UPDATED_QUOTE",
    //   relevantEdprowise.map((admin) => ({
    //     id: admin._id.toString(),
    //     type: "edprowise",
    //   })),
    //   {
    //     companyName: sellerProfile.companyName,
    //     schoolName: schoolProfile.schoolName,
    //     quoteNumber: existingQuoteProposal.quoteNumber,
    //     enquiryNumber: existingQuoteProposal.enquiryNumber,
    //     entityId: existingQuoteProposal._id,
    //     entityType: "QuoteProposal From Seller",
    //     senderType: "seller",
    //     senderId: sellerId,
    //     metadata: {
    //       enquiryNumber,
    //       sellerId: sellerId,
    //       type: "quote_updated_from_edprowise",
    //     },
    //   }
    // );

    return res.status(200).json({
      hasError: false,
      message: "PrepareQuote and QuoteProposal updated successfully.",
      data: {
        updatedPrepareQuote: existingQuote,
        updatedQuoteProposal: existingQuoteProposal,
        updatedSubmitted: existingSubmitted,
      },
    });
  } catch (error) {
    console.error("Error updating PrepareQuote or QuoteProposal:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default updateSingleProduct;
