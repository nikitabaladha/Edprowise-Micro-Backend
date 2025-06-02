// ==================Email Routes =========================
import SMTPEmailSettings from "./SMTPEmailSettings.js";
import SignUPTemplatesRoutes from "./SignUPTemplatesRoutes.js";
import SellerEmailTemplateRoutes from "./SellerEmailTemplateRoutes.js";
import PasswordUpdateEmailTemplateRoutes from "./PasswordUpdateEmailTemplateRoutes.js";
import ForgotPasswordRoutes from "./ForgotPasswordRoutes.js";

export default (app) => {
  app.use("/api", SMTPEmailSettings);
  app.use("/api", SignUPTemplatesRoutes);
  app.use("/api", SellerEmailTemplateRoutes);
  app.use("/api", PasswordUpdateEmailTemplateRoutes);
  app.use("/api", ForgotPasswordRoutes);
};
