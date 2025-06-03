import loginSignupRoutes from "./login-signup.js";

import schoolRoutes from "./schoolRegistration.js";
import schoolProfileRoutes from "./school-profile.js";
import userRoutes from "./user.js";
import schoolUserRoutes from "./school-user.js";
import SellerRoutes from "./seller-profile.js";
import SellerUserRoutes from "./seller-user.js";
import EdprowiseProfileRoutes from "./edprowiseProfile.js";
import AdminUserRoutes from "./admin.js";
import NewAdminRoutes from "./NewAdmin.js";

import CrossServiceAPI from "./cross-service-api.js";

export default (app) => {
  app.use("/api", loginSignupRoutes);
  app.use("/api", schoolRoutes);
  app.use("/api", SellerRoutes);
  app.use("/api", schoolUserRoutes);
  app.use("/api", SellerUserRoutes);
  app.use("/api", userRoutes);
  app.use("/api", schoolProfileRoutes);
  app.use("/api", EdprowiseProfileRoutes);
  app.use("/api", AdminUserRoutes);
  app.use("/api", NewAdminRoutes);
  app.use("/api", CrossServiceAPI);
};
