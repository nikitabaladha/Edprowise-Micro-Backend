import {
  getAllEdprowiseAdmins,
  getAllSchoolProfiles,
  getAllSellerProfiles,
} from "../AxiosRequestService/userServiceRequest.js";

export const getAllEmails = async (req, res) => {
  try {
    const [schoolRes, sellerRes, adminRes] = await Promise.all([
      getAllSchoolProfiles("schoolEmail"),
      getAllSellerProfiles("emailId"),
      getAllEdprowiseAdmins("email"),
    ]);

    if (schoolRes.hasError || sellerRes.hasError || adminRes.hasError) {
      return res.status(500).json({
        hasError: true,
        message: "Failed to fetch some or all email lists",
        details: {
          schoolError: schoolRes.hasError ? schoolRes.message : null,
          sellerError: sellerRes.hasError ? sellerRes.message : null,
          adminError: adminRes.hasError ? adminRes.message : null,
        },
      });
    }

    const schoolEmails = schoolRes.data.map((obj) => obj.schoolEmail);
    const sellerEmails = sellerRes.data.map((obj) => obj.emailId);
    const adminEmails = adminRes.data.map((obj) => obj.email);

    const allEmails = [...schoolEmails, ...sellerEmails, ...adminEmails];

    const uniqueEmails = [...new Set(allEmails.filter(Boolean))];

    return res.status(200).json({
      hasError: false,
      data: uniqueEmails,
    });
  } catch (error) {
    console.error("Error in getAllEmails:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export default getAllEmails;
