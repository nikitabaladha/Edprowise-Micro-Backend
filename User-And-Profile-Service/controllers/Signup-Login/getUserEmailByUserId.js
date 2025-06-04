// controllers/UserController.js
import Seller from "../../models/Seller.js";
import SellerProfile from "../../models/SellerProfile.js";
import User from "../../models/User.js";
import School from "../../models/School.js";

async function getUserEmailByUserId(req, res) {
  const { userId } = req.params;

  try {
    let email = null;

    const seller = await Seller.findOne({ userId });

    if (seller) {
      const sellerProfile = await SellerProfile.findOne({
        sellerId: seller._id,
      });

      email = sellerProfile?.emailId;
    } else {
      const user = await User.findOne({ userId });

      if (user) {
        const school = await School.findOne({ schoolId: user.schoolId });

        email = school?.schoolEmail;
      }
    }

    if (!email) {
      return res
        .status(404)
        .json({ hasError: true, message: "Email not found" });
    }

    return res.json({ hasError: false, email });
  } catch (error) {
    console.error("Error in getUserEmailByUserId:", error);
    return res
      .status(500)
      .json({ hasError: true, message: "Internal Server Error" });
  }
}

export default getUserEmailByUserId;
