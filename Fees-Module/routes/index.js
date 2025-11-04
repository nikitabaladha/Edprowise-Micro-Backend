import AdminSettingRoutes from "./AdminSetting.js";
import FormRoutes from "./Form.js";
import FeesReceiptsRoutes from "./FeesReceipts.js";
import FeesManagementYearRoutes from "./FeesManagementYear.js";
import Reports from "./Reports.js";

export default (app) => {
  // ================Fees Module====================
  app.use("/api", AdminSettingRoutes);
  app.use("/api", FormRoutes);
  app.use("/api", FeesReceiptsRoutes);
  app.use("/api", FeesManagementYearRoutes);
  app.use("/api", Reports);
};
