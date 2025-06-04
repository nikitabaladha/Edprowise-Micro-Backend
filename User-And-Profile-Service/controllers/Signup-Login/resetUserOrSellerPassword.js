import User from "../../models/User.js";
import Seller from "../../models/Seller.js";
import School from "../../models/School.js";
import SellerProfile from "../../models/SellerProfile.js";
import saltFunction from "../../validators/saltFunction.js";

async function resetUserOrSellerPassword(req, res) {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({
        hasError: true,
        message: "userId and newPassword are required.",
      });
    }

    const { hashedPassword, salt } = saltFunction.hashPassword(newPassword);

    // Try School User
    const user = await User.findOne({ userId });
    if (user) {
      user.password = hashedPassword;
      user.salt = salt;
      await user.save();

      const school = await School.findOne({ schoolId: user.schoolId });

      return res.status(200).json({
        hasError: false,
        message: "Password updated for school user.",
        data: {
          userName: user.userId,
          password: newPassword,
          email: school?.schoolEmail || "unknown@email.com",
          companyName: school?.schoolName || "School",
          role: "School",
        },
      });
    }

    // Try Seller
    const seller = await Seller.findOne({ userId });
    if (seller) {
      seller.password = hashedPassword;
      seller.salt = salt;
      await seller.save();

      const sellerProfile = await SellerProfile.findOne({
        sellerId: seller._id,
      });

      return res.status(200).json({
        hasError: false,
        message: "Password updated for seller.",
        data: {
          userName: seller.userId,
          password: newPassword,
          email: sellerProfile?.emailId || "unknown@email.com",
          companyName: sellerProfile?.companyName || "Seller",
          role: "Seller",
        },
      });
    }

    return res.status(404).json({
      hasError: true,
      message: "User ID not found in User or Seller collections.",
    });
  } catch (error) {
    console.error("Error resetting password:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Server error while resetting password.",
    });
  }
}

export default resetUserOrSellerPassword;
