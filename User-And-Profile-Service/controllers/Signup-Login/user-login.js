import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import Seller from "../../models/Seller.js";
import saltFunction from "../../validators/saltFunction.js";
import loginValidationSchema from "../../validators/loginValidationSchema.js";

import { getSubscriptionBySchoolId } from "../AxiosRequestService/subscriptionServiceRequest.js";
dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
const jwtExpiration = process.env.JWT_EXPIRATION;

async function userLogin(req, res) {
  try {
    const { error } = loginValidationSchema.UserLoginValidationSchema.validate(
      req.body
    );

    if (error?.details?.length) {
      const errorMessages = error.details[0].message;
      return res.status(400).json({ message: errorMessages });
    }

    const { userId, password } = req.body;

    let user = await User.findOne({ userId });
    let schemaType = "User";

    if (!user) {
      user = await Seller.findOne({ userId });
      schemaType = user ? "Seller" : null;
    }

    if (!user) {
      return res.status(404).json({
        hasError: true,
        message: "User does not exist",
      });
    }

    const isPasswordValid = await saltFunction.validatePassword(
      password,
      user.password,
      user.salt
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        hasError: true,
        message: "Invalid Password",
      });
    }

    let tokenPayload = {
      id: user._id,
      userId: user.userId,
      role: user.role,
      status: user.status,
    };

    if (schemaType === "User") {
      tokenPayload.schoolId = user.schoolId;

      const subscriptionResponse = await getSubscriptionBySchoolId(
        user.schoolId,
        "subscriptionFor,subscriptionEndDate"
      );

      if (subscriptionResponse.hasError) {
        return res.status(500).json({
          hasError: true,
          message: "Failed to fetch subscription data",
          error: subscriptionResponse.error,
        });
      }

      tokenPayload.subscription = subscriptions || [];
    }

    const token = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: jwtExpiration,
    });

    return res.status(200).json({
      hasError: false,
      message: "Login Successful",
      token,
      userDetails: tokenPayload,
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "An unexpected server error occurred. Please try again later.",
    });
  }
}

export default userLogin;
