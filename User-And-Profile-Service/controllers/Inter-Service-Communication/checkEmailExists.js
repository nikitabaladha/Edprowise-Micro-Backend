// // Edprowise-Micro-Backend\User-And-Profile-Service\controllers\CrossServiceAPI\checkEmailExists.js

// import SellerProfile from "../../models/SellerProfile.js";
// import School from "../../models/School.js";

// async function checkEmailExists(req, res) {
//   try {
//     const { email } = req.body;

//     const sellerProfile = await SellerProfile.findOne({ emailId: email });
//     const schoolProfile = await School.findOne({ schoolEmail: email });

//     return res.json({
//       exists: !!(sellerProfile || schoolProfile),
//     });
//   } catch (error) {
//     console.error("Error checking email:", error);
//     return res.status(500).json({
//       hasError: true,
//       message: "Failed to check email existence",
//     });
//   }
// }

// export default checkEmailExists;

// GET /api/check-email-exists?email=abc@example.com

import SellerProfile from "../../models/SellerProfile.js";
import School from "../../models/School.js";

async function checkEmailExists(req, res) {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        hasError: true,
        message: "Email is required",
      });
    }

    const sellerProfile = await SellerProfile.findOne({ emailId: email });
    const schoolProfile = await School.findOne({ schoolEmail: email });

    return res.json({
      exists: !!(sellerProfile || schoolProfile),
    });
  } catch (error) {
    console.error("Error checking email:", error);
    return res.status(500).json({
      hasError: true,
      message: "Failed to check email existence",
    });
  }
}

export default checkEmailExists;
