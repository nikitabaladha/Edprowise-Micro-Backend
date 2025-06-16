import mongoose from "mongoose";
import axios from "axios";

import SubmitQuote from "../../models/SubmitQuote.js";
import SubmitQuoteValidator from "../../validators/SubmitQuote.js";
import QuoteProposal from "../../models/QuoteProposal.js";

import { getQuoteRequestByEnquiryNumber } from "../AxiosRequestService/quoteRequestServiceRequest.js";

import {
  getSellerById,
  getrequiredFieldsFromEdprowiseProfile,
  getAllEdprowiseAdmins,
} from "../AxiosRequestService/userServiceRequest.js";

import { sendNotification } from "../AxiosRequestService/notificationServiceRequest.js";

async function updateDeliveryCharges(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { enquiryNumber, sellerId } = req.query;

    if (!enquiryNumber || !sellerId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumber and sellerId are required.",
      });
    }

    const { error } =
      SubmitQuoteValidator.SubmitQuoteUpdateDeliveryCharges.validate(req.body);
    if (error?.details?.length) {
      await session.abortTransaction();
      session.endSession();
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

    // Find and update SubmitQuote
    const existingQuote = await SubmitQuote.findOneAndUpdate(
      { enquiryNumber, sellerId },
      { deliveryCharges: req.body.deliveryCharges },
      { new: true, session }
    );

    if (!existingQuote) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "Quote not found for the given enquiryNumber and sellerId.",
      });
    }

    const [quoteRequestRes, sellerRes, edprowiseRes, existingQuoteProposal] =
      await Promise.all([
        getQuoteRequestByEnquiryNumber(enquiryNumber, "deliveryState,schoolId"),
        getSellerById(sellerId, "companyName,state"),
        getrequiredFieldsFromEdprowiseProfile("state"),
        QuoteProposal.findOne({ enquiryNumber, sellerId }).session(session),
      ]);

    const quoteRequest = quoteRequestRes?.data;
    const sellerProfile = sellerRes?.data;
    const edprowiseProfile = edprowiseRes?.data;

    if (
      quoteRequestRes.hasError ||
      sellerRes.hasError ||
      edprowiseRes.hasError ||
      !existingQuoteProposal
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "Required data not found.",
      });
    }

    // Extract states
    const schoolState = quoteRequest.deliveryState;
    const sellerState = sellerProfile.state;
    const edprowiseState = edprowiseProfile.state;

    if (!schoolState || !sellerState || !edprowiseState) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Location data is incomplete.",
      });
    }

    // Determine GST rates based on location scenarios
    let deliveryCgstRate = 0;
    let deliverySgstRate = 0;
    let deliveryIgstRate = 0;

    // done
    if (schoolState === edprowiseState && edprowiseState === sellerState) {
      deliveryCgstRate = 9;
      deliverySgstRate = 9;
      deliveryIgstRate = 0;
    }
    // Scenario 2: School ≠ Edprowise = Seller ===done
    else if (schoolState !== edprowiseState && edprowiseState === sellerState) {
      deliveryCgstRate = 0;
      deliverySgstRate = 0;
      deliveryIgstRate = 18;
    }
    // Scenario 3: All locations different ====done
    else if (schoolState !== edprowiseState && edprowiseState !== sellerState) {
      deliveryCgstRate = 0;
      deliverySgstRate = 0;
      deliveryIgstRate = 18;
    }
    // Scenario 4: School = Edprowise ≠ Seller
    else if (schoolState === edprowiseState && edprowiseState !== sellerState) {
      deliveryCgstRate = 9;
      deliverySgstRate = 9;
      deliveryIgstRate = 0;
    }

    // Calculate GST amounts
    const deliveryCharges = existingQuote.deliveryCharges || 0;
    const totalDeliveryGstAmount =
      (deliveryCharges *
        (deliveryCgstRate + deliverySgstRate + deliveryIgstRate)) /
      100;

    // Update QuoteProposal
    const updatedQuoteProposal = await QuoteProposal.findOneAndUpdate(
      { enquiryNumber, sellerId },
      {
        totalDeliveryGstAmount,
        totalDeliveryGstAmountForEdprowise: totalDeliveryGstAmount,
        deliveryCgstRate,
        deliverySgstRate,
        deliveryIgstRate,
      },
      { new: true, session }
    );

    const schoolId = quoteRequest?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "schoolId Not found.",
      });
    }

    const senderId = req.user.id;

    const quoteProposal = await QuoteProposal.findOne({
      enquiryNumber,
      sellerId,
    }).session(session);

    if (!senderId) {
      return res.status(401).json({
        hasError: true,
        message: "Edprowise not authenticated.",
      });
    }

    const adminResponse = await getAllEdprowiseAdmins("id");

    if (adminResponse.hasError || !adminResponse.data) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        hasError: true,
        message: "Failed to fetch Edprowise admins.",
        error: adminResponse.error,
      });
    }

    const relevantEdprowise = adminResponse.data;

    try {
      await sendNotification(
        "SCHOOL_QUOTE_RECEIVED_FROM_EDPROWISE",
        schoolId ? [{ id: schoolId.toString(), type: "school" }] : [],
        {
          companyName: sellerProfile.companyName,
          enquiryNumber: quoteProposal.enquiryNumber,
          quoteNumber: quoteProposal.quoteNumber,
          entityId: quoteProposal._id,
          entityType: "QuoteProposal From Edprowise",
          senderType: "edprowise",
          senderId: senderId,
          metadata: {
            enquiryNumber,
            sellerId: quoteProposal.sellerId,
            type: "quote_received_from_edprowise",
          },
        }
      );

      await sendNotification(
        "EDPROWISE_ACCEPTED_QUOTE",
        relevantEdprowise.map((admin) => ({
          id: admin._id.toString(),
          type: "edprowise",
        })),
        {
          companyName: sellerProfile.companyName,
          quoteNumber: quoteProposal.quoteNumber,
          enquiryNumber: quoteProposal.enquiryNumber,
          entityId: quoteProposal._id,
          entityType: "QuoteProposal From Edprowise",
          senderType: "edprowise",
          senderId: senderId,
          metadata: {
            enquiryNumber,
            sellerId: quoteProposal.sellerId,
            type: "quote_accepted_from_edprowise",
          },
        }
      );
    } catch (notificationError) {
      throw new Error("Notification failed: " + notificationError.message);
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Delivery charges updated successfully.",
      data: {
        submitQuote: existingQuote,
        quoteProposal: updatedQuoteProposal,
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    console.error("Error updating delivery charges:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default updateDeliveryCharges;
