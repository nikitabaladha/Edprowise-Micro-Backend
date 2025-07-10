import path from "path";
import fs from "fs";
import { format } from "date-fns";

import PrepareQuote from "../../models/PrepareQuote.js";
import QuoteProposal from "../../models/QuoteProposal.js";
import SubmitQuote from "../../models/SubmitQuote.js";

import GeneratePDF from "./generatePDF.js";

import {
  getSchoolById,
  getSellerById,
  getrequiredFieldsFromEdprowiseProfile,
} from "../AxiosRequestService/userServiceRequest.js";

import { getQuoteRequestBySchoolIdAndEnqNo } from "../AxiosRequestService/quoteRequestServiceRequest.js";

import { getOrderDetailsFromSellerBySchooIdSellerId } from "../AxiosRequestService/orderServiceRequest.js";

async function invoiceForEdprowisePDFRequirements(req, res) {
  try {
    const { sellerId, enquiryNumber, schoolId } = req.query;

    if (!sellerId || !enquiryNumber || !schoolId) {
      return res.status(400).json({
        hasError: true,
        message: "Seller ID, Enquiry Number, and School ID are required.",
      });
    }

    const [
      schoolData,
      quoteRequestData,
      quoteProposal,
      submitQuote,
      sellerProfileData,
      edprowiseProfileData,
      orderDetailsData,
      prepareQuotesData,
    ] = await Promise.all([
      getSchoolById(
        schoolId,
        "schoolName schoolEmail schoolMobileNo panNo schoolAddress city state country landMark schoolPincode"
      ),
      getQuoteRequestBySchoolIdAndEnqNo(
        enquiryNumber,
        schoolId,
        "deliveryAddress,deliveryLandMark,deliveryCountry,deliveryState,deliveryCity,createdAt,enquiryNumber"
      ),

      QuoteProposal.findOne({ enquiryNumber, sellerId }).lean(),
      SubmitQuote.findOne({ enquiryNumber, sellerId }).select(
        "paymentTerms advanceRequiredAmount expectedDeliveryDateBySeller advanceRequiredAmount"
      ),

      getSellerById(
        sellerId,
        "companyName address landmark cit state country gstin pan contactNo emailId"
      ),

      getrequiredFieldsFromEdprowiseProfile(
        "companyName companyType gstin pan tan cin address city state country landmark pincode contactNo alternateContactNo emailId"
      ),

      getOrderDetailsFromSellerBySchooIdSellerId(
        schoolId,
        sellerId,
        "invoiceDate,invoiceForSchool,invoiceForEdprowise,orderNumber"
      ),
      PrepareQuote.find({ sellerId, enquiryNumber }),
    ]);

    if (!schoolData || schoolData.hasError) {
      return res.status(404).json({
        hasError: true,
        message: "School data not found or has error.",
      });
    }

    if (!quoteRequestData || quoteRequestData.hasError) {
      return res.status(404).json({
        hasError: true,
        message: "Quote request data not found or has error.",
      });
    }

    if (!quoteProposal) {
      return res.status(404).json({
        hasError: true,
        message: "Quote proposal data not found.",
      });
    }

    if (!sellerProfileData || sellerProfileData.hasError) {
      return res.status(404).json({
        hasError: true,
        message: "Seller profile data not found or has error.",
      });
    }

    if (!edprowiseProfileData || edprowiseProfileData.hasError) {
      return res.status(404).json({
        hasError: true,
        message: "Edprowise profile data not found or has error.",
      });
    }

    if (!orderDetailsData || orderDetailsData.hasError) {
      return res.status(404).json({
        hasError: true,
        message: "Order details from seller not found or has error.",
      });
    }

    if (!prepareQuotesData || !prepareQuotesData.length) {
      return res.status(404).json({
        hasError: true,
        message: "No prepared quote data found for the given enquiry.",
      });
    }

    const prepareQuotesWithStatus = prepareQuotesData.map((quote) => ({
      ...quote.toObject(),
      supplierStatus: quoteProposal?.supplierStatus || null,
    }));

    const fileName = "PDF-Invoive-Edprowise-Format.ejs";

    const __dirname = path.resolve();

    const htmlPath = path.join(
      __dirname,
      "controllers",
      "PDFForFrontend",
      fileName
    );

    const outputFileName = fileName
      .replace(".", `-${Date.now()}.`)
      .replace("ejs", "pdf");
    const outputPath = path.join(__dirname, "temp", outputFileName);

    const formatCost = (value) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
      }).format(value);

    const formatDate = (dateString) =>
      dateString ? format(new Date(dateString), "dd/MM/yyyy") : "N/A";

    const convertToWords = (n) => {
      if (n === 0) return "Zero Rs only";
      const units = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
      ];
      const tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
      ];
      const thousands = ["", "Thousand", "Million", "Billion"];

      const convertLessThanThousand = (num) => {
        let str = "";
        if (num >= 100) {
          str += `${units[Math.floor(num / 100)]} Hundred `;
          num %= 100;
        }
        if (num >= 20) {
          str += `${tens[Math.floor(num / 10)]} `;
          num %= 10;
        }
        if (num > 0) str += `${units[num]} `;
        return str.trim();
      };

      let words = "",
        group = 0;
      while (n > 0) {
        const chunk = n % 1000;
        if (chunk > 0) {
          words = `${convertLessThanThousand(chunk)} ${
            thousands[group]
          } ${words}`;
        }
        n = Math.floor(n / 1000);
        group++;
      }
      return words.trim();
    };

    const school = schoolData.data;
    const quoteRequest = quoteRequestData.data;
    const sellerProfile = sellerProfileData.data;
    const edprowiseProfile = edprowiseProfileData.data;
    const orderDetails = orderDetailsData.data;

    const signaturePath = path.join(
      __dirname,
      "Images",
      "SellerSignature",
      path.basename(sellerProfile.signature)
    );

    let signatureDataURI = "";
    if (!signatureDataURI) {
      const signatureBuffer = fs.readFileSync(signaturePath);
      const signatureType = path.extname(signaturePath).replace(".", "");
      signatureDataURI = `data:image/${signatureType};base64,${signatureBuffer.toString(
        "base64"
      )}`;
    }

    const dynamicData = {
      prepareQuoteData: prepareQuotesWithStatus,
      quoteProposalData: quoteProposal,
      profileData: {
        // School
        buyerName: school.schoolName,
        schoolContactNumber: school.schoolMobileNo,
        schoolPanNumber: school.panNo,
        schoolAddress: school.schoolAddress,
        schoolCity: school.city,
        schoolState: school.state,
        schoolCountry: school.country,
        schoolLandmark: school.landMark,
        schoolPincode: school.schoolPincode,
        schoolEmailId: school.schoolEmail,
        schoolDeliveryAddress: `${quoteRequest.deliveryAddress || ""}${
          quoteRequest.deliveryLandMark
            ? `, ${quoteRequest.deliveryLandMark}`
            : ""
        }`,
        schoolDeliveryCity: quoteRequest.deliveryCity,
        schoolDeliveryState: quoteRequest.deliveryState,
        schoolDeliveryCountry: quoteRequest.deliveryCountry,
        quoteRequestedDate: quoteRequest.createdAt,
        enquiryNumber: quoteRequest.enquiryNumber,
        // Quote
        quoteNumber: quoteProposal.quoteNumber,
        quoteProposalDate: quoteProposal.createdAt,
        paymentTerms: submitQuote?.paymentTerms || null,
        advanceRequiredAmount: submitQuote?.advanceRequiredAmount || null,
        expectedDeliveryDate: submitQuote?.expectedDeliveryDateBySeller || null,
        deliveryCharges: submitQuote?.deliveryCharges || null,
        // Seller
        sellerCompanyName: sellerProfile.companyName,
        signature: signatureDataURI,
        sellerAddress: `${sellerProfile.address || ""}${
          sellerProfile.landmark ? `, ${sellerProfile.landmark}` : ""
        }`,
        sellerCity: sellerProfile.city,
        sellerState: sellerProfile.state,
        sellerCountry: sellerProfile.country,
        sellerGstin: sellerProfile.gstin,
        sellerPanNumber: sellerProfile.pan,
        sellerContactNumber: sellerProfile.contactNo,
        sellerEmailId: sellerProfile.emailId,
        // Edprowise
        edprowiseCompanyName: edprowiseProfile.companyName,
        edprowiseCompanyType: edprowiseProfile.companyType,
        edprowiseGstin: edprowiseProfile.gstin,
        edprowisePan: edprowiseProfile.pan,
        edprowiseTan: edprowiseProfile.tan,
        edprowiseCin: edprowiseProfile.cin,
        edprowiseAddress: `${edprowiseProfile.address || ""}${
          edprowiseProfile.landmark ? `, ${edprowiseProfile.landmark}` : ""
        }`,
        edprowiseCity: edprowiseProfile.city,
        edprowiseState: edprowiseProfile.state,

        edprowiseCountry: edprowiseProfile.country,

        edprowisePincode: edprowiseProfile.pincode,
        edprowiseContactNo: edprowiseProfile.contactNo,
        edprowiseAlternateContactNo: edprowiseProfile.alternateContactNo,
        edprowiseEmailId: edprowiseProfile.emailId,
        insuranceCharges: edprowiseProfile.insuranceCharges,

        // Invoice
        invoiceDate: orderDetails?.invoiceDate || null,
        invoiceForSchool: orderDetails?.invoiceForSchool || null,
        invoiceForEdprowise: orderDetails?.invoiceForEdprowise || null,
        orderNumber: orderDetails?.orderNumber || null,
      },
      formatCost,
      formatDate,
      convertToWords,
    };

    await GeneratePDF(htmlPath, dynamicData, outputPath);

    const fileData = fs.readFileSync(outputPath);
    fs.unlinkSync(outputPath);

    return res.status(200).send(fileData);
  } catch (error) {
    console.error("Error in InvoicePDFRequirements:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error while generating PDF.",
    });
  }
}

export default invoiceForEdprowisePDFRequirements;
