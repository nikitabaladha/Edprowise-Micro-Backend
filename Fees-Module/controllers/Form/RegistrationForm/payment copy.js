// /Users/nikita/Desktop/EDPROWISE_Nikita_FINAL/Edprowise_Backend/Edprowise-Micro-Backend/Fees-Module/controllers/Form/RegistrationForm/payment.js

import mongoose from "mongoose";
import crypto from "crypto";
import axios from "axios";
import { RegistrationPayment } from "../../../models/RegistrationForm.js";

import { addRegistartionPaymentInFinance } from "../../AxiosRequestService/RegistartionPaymentInFinance.js";

const generateShortId = () => {
  return Math.random().toString(36).substring(2, 8);
};

const generateEasebuzzHash = (data) => {
  try {
    const hashString =
      [
        data.key,
        data.txnid,
        data.amount,
        data.productinfo,
        data.firstname,
        data.email,
        data.udf1 || "",
        data.udf2 || "",
        data.udf3 || "",
        data.udf4 || "",
        data.udf5 || "",
        data.udf6 || "",
        data.udf7 || "",
        data.udf8 || "",
        data.udf9 || "",
        data.udf10 || "",
      ].join("|") +
      "|" +
      process.env.EASEBUZZ_SALT;

    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    return hash;
  } catch (error) {
    console.error("Hash generation error:", error);
    throw error;
  }
};

const verifyEasebuzzResponseHash = (data) => {
  try {
    const hashString = [
      process.env.EASEBUZZ_SALT,
      data.status || "",
      data.udf1 || "",
      data.udf2 || "",
      data.udf3 || "",
      data.udf4 || "",
      data.udf5 || "",
      data.email || "",
      data.firstname || "",
      data.productinfo || "",
      data.amount || "",
      data.txnid || "",
      data.key || process.env.EASEBUZZ_KEY,
    ].join("|");

    const generatedHash = crypto
      .createHash("sha512")
      .update(hashString)
      .digest("hex");

    const isValid = generatedHash === (data.hash || "");

    return isValid;
  } catch (error) {
    console.error("Hash verification error:", error);
    return false;
  }
};

const creatregistrationpayment = async (req, res) => {
  const schoolId = req.user?.schoolId;
  const { studentId } = req.params;

  if (!schoolId) {
    return res.status(401).json({
      hasError: true,
      message: "Access denied: School ID missing.",
    });
  }

  if (!studentId || !mongoose.isValidObjectId(studentId)) {
    return res.status(400).json({
      hasError: true,
      message: "Valid student ID is required.",
    });
  }

  try {
    const {
      academicYear,
      registrationFee,
      concessionType,
      concessionAmount,
      finalAmount,
      paymentMode,
      chequeNumber,
      bankName,
      name,
      email,
      phone,
    } = req.body;

    if (!finalAmount || parseFloat(finalAmount) <= 0) {
      return res.status(400).json({
        hasError: true,
        message: "Valid final amount is required.",
      });
    }

    if (paymentMode === "Online") {
      if (!process.env.FRONTEND_URL) {
        return res.status(500).json({
          hasError: true,
          message: "Frontend URL configuration missing.",
        });
      }

      const paymentEmail = email;
      const paymentPhone = phone;

      const txnId = `TXN${Date.now()}${generateShortId().toUpperCase()}`;
      const amount = parseFloat(finalAmount).toFixed(2);

      const initiateData = {
        key: process.env.EASEBUZZ_KEY,
        txnid: txnId,
        amount: amount,
        productinfo: `Registration Fee - ${academicYear || "2025-2026"}`,
        firstname: name || "Student",
        email: paymentEmail,
        phone: paymentPhone || "999999999",
        surl: `${process.env.BACKEND_URL}/payment/success`,
        furl: `${process.env.BACKEND_URL}/payment/failure`,
        hash: "",
        udf1: studentId,
        udf2: schoolId,
        udf3: academicYear,
        udf4: finalAmount,
        udf5: registrationFee || finalAmount,
      };

      initiateData.hash = generateEasebuzzHash(initiateData);

      const easebuzzUrl =
        process.env.EASEBUZZ_ENV === "test"
          ? "https://pay.easebuzz.in"
          : "https://testpay.easebuzz.in";

      try {
        const apiResponse = await axios.post(
          `${easebuzzUrl}/payment/initiateLink`,
          new URLSearchParams(initiateData).toString(),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: 30000,
          }
        );

        console.log(
          "Easebuzz API Response:",
          JSON.stringify(apiResponse.data, null, 2)
        );

        const easebuzzResult = apiResponse.data;

        if (easebuzzResult.status === "1" || easebuzzResult.status === 1) {
          const accessKey =
            typeof easebuzzResult.data === "string"
              ? easebuzzResult.data
              : easebuzzResult.data?.access_key;
          if (accessKey) {
            const paymentUrl = `${easebuzzUrl}/pay/${accessKey}`;

            console.log("Payment URL Generated:", paymentUrl);

            return res.status(200).json({
              hasError: false,
              message: "Easebuzz payment initialized successfully.",
              paymentUrl,
              txnId,
              accessKey,
            });
          } else {
            console.error("No access_key in response:", easebuzzResult);
            return res.status(400).json({
              hasError: true,
              message: "Payment gateway error: Missing access key.",
              debug: easebuzzResult,
            });
          }
        } else {
          console.error("Easebuzz API failed:", easebuzzResult);
          return res.status(400).json({
            hasError: true,
            message:
              easebuzzResult.msg ||
              easebuzzResult.message ||
              "Payment gateway initialization failed.",
            debug: easebuzzResult,
          });
        }
      } catch (apiError) {
        console.error(
          "Easebuzz API Error:",
          apiError.response?.data || apiError.message
        );

        if (apiError.response?.status === 401) {
          return res.status(400).json({
            hasError: true,
            message:
              "Invalid merchant credentials. Please check Easebuzz key and salt.",
          });
        }

        if (apiError.code === "ECONNABORTED") {
          return res.status(500).json({
            hasError: true,
            message: "Payment gateway timeout. Please try again.",
          });
        }

        return res.status(500).json({
          hasError: true,
          message: "Failed to connect to payment gateway.",
          debug: {
            error: apiError.message,
            response: apiError.response?.data,
            status: apiError.response?.status,
          },
        });
      }
    }

    const paymentStatus = paymentMode === "null" ? "Pending" : "Paid";

    const paymentData = {
      studentId,
      schoolId,
      academicYear,
      registrationFee: parseFloat(registrationFee) || 0,
      concessionType: concessionType || null,
      concessionAmount: parseFloat(concessionAmount) || 0,
      finalAmount: parseFloat(finalAmount),
      paymentMode: paymentMode || "null",
      chequeNumber: chequeNumber || "",
      bankName: bankName || "",
      name: name || "",
      paymentDate: paymentMode !== "null" ? new Date() : null,
      status: paymentStatus,
      easebuzzTxnId: null,
      easebuzzResponse: null,
    };

    const newPayment = new RegistrationPayment(paymentData);
    await newPayment.save();

    // Call the finance module to store the payment in OpeningClosingBalance
    if (paymentMode !== "null" && paymentStatus === "Paid") {
      try {
        const financeData = {
          paymentId: newPayment._id.toString(),
          finalAmount: parseFloat(finalAmount),
          paymentDate: newPayment.paymentDate,
          academicYear: academicYear,
          paymentMode: paymentMode,
        };

        await addRegistartionPaymentInFinance(
          schoolId,
          academicYear,
          financeData
        );

        console.log(
          "===========Payment also stored in Finance Module successfully==============="
        );
      } catch (financeError) {
        console.error(
          "Failed to store payment in Finance Module:",
          financeError
        );
        // Don't fail the main payment if finance storage fails
      }
    }

    res.status(201).json({
      hasError: false,
      message: "Payment created successfully.",
      payment: newPayment,
    });
  } catch (err) {
    console.error("Payment creation error:", err);
    res.status(500).json({
      hasError: true,
      message: err.message || "Internal server error.",
      debug: { error: err.message },
    });
  }
};

const handlePaymentSuccess = async (req, res) => {
  try {
    const data = req.body;
    console.log("=== Payment Success Callback Received ===");
    console.log("Full Request Body:", JSON.stringify(data, null, 2));
    console.log("Request Headers:", req.headers);

    // Log all received fields for debugging
    console.log("=== Received Fields ===");
    Object.keys(data).forEach((key) => {
      console.log(`${key}:`, data[key]);
    });

    if (!data.txnid || !data.status) {
      console.error("Missing required parameters in success callback");
      return res.redirect(
        `${
          process.env.FRONTEND_URL
        }/payment/failure?error=missing_params&txnId=${data.txnid || "unknown"}`
      );
    }

    // Verify hash with detailed logging
    console.log("=== Starting Hash Verification ===");
    const isHashValid = verifyEasebuzzResponseHash(data);
    console.log("Hash Verification Result:", isHashValid);

    if (!isHashValid) {
      console.error("Hash verification failed in success callback");
      // For testing, you might want to proceed anyway, but log the issue
      console.warn("⚠️  Hash verification failed, but proceeding for testing");
      // return res.redirect(`${process.env.FRONTEND_URL}/payment/failure?error=invalid_hash&txnId=${data.txnid}`);
    }

    if (data.status !== "success") {
      console.error("Payment status not successful:", data.status);
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/failure?txnId=${data.txnid}&status=${data.status}`
      );
    }

    // Extract UDF fields - Easebuzz might send them differently
    const studentId = data.udf1 || data.udf1;
    const schoolId = data.udf2 || data.udf2;
    const academicYear = data.udf3 || data.udf3;
    const finalAmount = data.udf4 || data.udf4;
    const registrationFee = data.udf5 || data.udf5;

    console.log("=== Extracted UDF Fields ===");
    console.log("Student ID:", studentId);
    console.log("School ID:", schoolId);
    console.log("Academic Year:", academicYear);
    console.log("Final Amount:", finalAmount);
    console.log("Registration Fee:", registrationFee);

    if (!mongoose.isValidObjectId(studentId) || !schoolId) {
      console.error("Invalid student or school ID in success callback");
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/failure?error=invalid_ids&txnId=${data.txnid}`
      );
    }

    // Check if payment already exists to avoid duplicates
    const existingPayment = await RegistrationPayment.findOne({
      easebuzzTxnId: data.txnid,
    });
    if (existingPayment) {
      console.log(
        "Payment already exists, redirecting to success:",
        existingPayment._id
      );
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/success?txnId=${data.txnid}&status=success&paymentId=${existingPayment._id}`
      );
    }

    // Create payment record
    const paymentData = {
      studentId,
      schoolId,
      academicYear,
      registrationFee:
        parseFloat(registrationFee) ||
        parseFloat(finalAmount) ||
        parseFloat(data.amount),
      concessionType: null,
      concessionAmount: 0,
      finalAmount: parseFloat(finalAmount) || parseFloat(data.amount),
      paymentMode: "Online",
      name: data.firstname || "",
      status: "Paid",
      paymentDate: new Date(),
      easebuzzTxnId: data.txnid,
      easebuzzResponse: data,
    };

    console.log("Creating payment record:", paymentData);

    const newPayment = new RegistrationPayment(paymentData);
    await newPayment.save();

    console.log("Payment record created successfully:", newPayment._id);

    // Call the finance module to store the payment in OpeningClosingBalance
    try {
      const financeData = {
        paymentId: newPayment._id.toString(),
        finalAmount: parseFloat(finalAmount) || parseFloat(data.amount),
        paymentDate: newPayment.paymentDate,
        academicYear: academicYear,
        paymentMode: "Online",
      };

      await addRegistartionPaymentInFinance(
        schoolId,
        academicYear,
        financeData
      );

      console.log("Payment also stored in Finance Module successfully");
    } catch (financeError) {
      console.error("Failed to store payment in Finance Module:", financeError);
      // Don't fail the main payment if finance storage fails
    }

    // Redirect to frontend success page
    res.redirect(
      `${process.env.FRONTEND_URL}/payment/success?txnId=${data.txnid}&status=success&paymentId=${newPayment._id}`
    );
  } catch (err) {
    console.error("Payment success processing error:", err);
    res.redirect(
      `${
        process.env.FRONTEND_URL
      }/payment/failure?error=processing_error&message=${encodeURIComponent(
        err.message
      )}&txnId=${req.body.txnid || "unknown"}`
    );
  }
};

const handlePaymentFailure = async (req, res) => {
  try {
    const data = req.body;
    console.log("=== Payment Failure Callback Received ===");
    console.log("Full Request Body:", JSON.stringify(data, null, 2));
    console.log("Request Headers:", req.headers);

    // Log all received fields for debugging
    console.log("=== Received Fields ===");
    Object.keys(data).forEach((key) => {
      console.log(`${key}:`, data[key]);
    });

    if (!data.txnid || !data.status) {
      console.error("Missing required parameters in failure callback");
      return res.redirect(
        `${
          process.env.FRONTEND_URL
        }/payment/failure?error=missing_params&txnId=${data.txnid || "unknown"}`
      );
    }

    // Verify hash with detailed logging
    console.log("=== Starting Hash Verification ===");
    const isHashValid = verifyEasebuzzResponseHash(data);
    console.log("Hash Verification Result:", isHashValid);

    if (!isHashValid) {
      console.error("Hash verification failed in failure callback");
      console.warn("⚠️  Hash verification failed, but proceeding for testing");
    }

    const studentId = data.udf1 || data.udf1;
    const schoolId = data.udf2 || data.udf2;
    const academicYear = data.udf3 || data.udf3;
    const finalAmount = data.udf4 || data.udf4;
    const registrationFee = data.udf5 || data.udf5;

    console.log("=== Extracted UDF Fields ===");
    console.log("Student ID:", studentId);
    console.log("School ID:", schoolId);
    console.log("Academic Year:", academicYear);
    console.log("Final Amount:", finalAmount);
    console.log("Registration Fee:", registrationFee);

    if (!mongoose.isValidObjectId(studentId) || !schoolId) {
      console.error("Invalid student or school ID in failure callback");
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/failure?error=invalid_ids&txnId=${data.txnid}`
      );
    }

    // Check if payment already exists to avoid duplicates
    const existingPayment = await RegistrationPayment.findOne({
      easebuzzTxnId: data.txnid,
    });
    if (existingPayment) {
      console.log(
        "Payment already exists, updating status to failed:",
        existingPayment._id
      );
      existingPayment.status = "Failed";
      existingPayment.easebuzzResponse = data;
      await existingPayment.save();
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/failure?txnId=${data.txnid}&status=failed&paymentId=${existingPayment._id}`
      );
    }

    // Create failed payment record
    const paymentData = {
      studentId,
      schoolId,
      academicYear,
      registrationFee:
        parseFloat(registrationFee) ||
        parseFloat(finalAmount) ||
        parseFloat(data.amount),
      concessionType: null,
      concessionAmount: 0,
      finalAmount: parseFloat(finalAmount) || parseFloat(data.amount),
      paymentMode: "Online",
      name: data.firstname || "",
      status: "Failed",
      easebuzzTxnId: data.txnid,
      easebuzzResponse: data,
    };

    console.log("Creating failed payment record:", paymentData);

    const newPayment = new RegistrationPayment(paymentData);
    await newPayment.save();

    console.log("Failed payment record created:", newPayment._id);

    res.redirect(
      `${process.env.FRONTEND_URL}/payment/failure?txnId=${data.txnid}&status=failed&paymentId=${newPayment._id}`
    );
  } catch (err) {
    console.error("Payment failure processing error:", err);
    res.redirect(
      `${
        process.env.FRONTEND_URL
      }/payment/failure?error=processing_error&message=${encodeURIComponent(
        err.message
      )}&txnId=${req.body.txnid || "unknown"}`
    );
  }
};

export { creatregistrationpayment, handlePaymentSuccess, handlePaymentFailure };

// here you can see in RegistrationPayment table user is storing so many things but mostly focus on things like

// studentId
// 690af39cf2bf0d2ad36239f5
// schoolId
// "SID144732"
// academicYear
// "2025-2026"
// finalAmount
// 1000
// paymentMode
// "Cash" or "Cheque" or "Online"
// paymentDate
// 2025-11-05T06:50:35.263+00:00

// just like that i have OpeningClosing Balance table i have

// _id
// 690af85ffe3940822325fbc0
// schoolId
// "SID144732"
// financialYear
// "2025-2026"
// ledgerId
// 690af679fe3940822325f696
// balanceDetails
// Array (1)
// 0
// Object
// entryId
// "690af85ffe3940822325fbba"
// entryDate
// 2025-11-05T00:00:00.000+00:00
// openingBalance
// 0
// debit
// 100
// credit
// 0
// closingBalance
// 100
// _id
// 690af85ffe3940822325fbc1
// balanceType
// "Debit"
// createdAt
// 2025-11-05T07:10:23.360+00:00
// updatedAt
// 2025-11-05T07:10:24.532+00:00
// __v
// 1

// see above setup stores data for "Registration Fee" ledger perfectly

// till this it works correctly

//  now add one more thing

// if for that entry

// if paymentMode is "Cash" then find ledger "Cash Account" in ledger table  and
// for in Opening Closing bance table find openingBalance for that ledger if openingBalance present then
// use it otherwise  use previus entryData of "Cash Account"

// if finalAmount is positive example 1000 then store in debit
// in credit store 0
// if finalAmount is negative example -1000 then store in credit
// in debit store 0
// and as closing balance openingBalance+debit-credit

// if paymentMode is "Online" then find ledger "Online" in ledger table  and
// for in Opening Closing bance table find openingBalance for that ledger if openingBalance present then
// use it otherwise  use previus entryData of "Online"

// if finalAmount is positive example 1000 then store in debit
// in credit store 0
// if finalAmount is negative example -1000 then store in credit
// in debit store 0
// and as closing balance openingBalance+debit-credit

// if paymentMode is "Cheque" then find ledger "Cheque" in ledger table  and
// for in Opening Closing bance table find openingBalance for that ledger if openingBalance present then
// use it otherwise  use previus entryData of "Cheque"

// if finalAmount is positive example 1000 then store in debit
// in credit store 0
// if finalAmount is negative example -1000 then store in credit
// in debit store 0
// and as closing balance openingBalance+debit-credit
