import PayrollAcademicYear from "./PayrollAcademicYear.js";
import PayrollEmployerRoutes from "./PayrollEmployerRoutes.js";
import PayrollAdminSettingRoutes from "./PayrollAdminSettingRoutes.js";
import PayrollEmployeeSelfRoutes from "./PayrollEmployeeSelfRoutes.js";

export default (app) => {
  app.use("/api", PayrollAcademicYear);
  app.use("/api", PayrollEmployerRoutes);
  app.use("/api", PayrollAdminSettingRoutes);
  app.use("/api", PayrollEmployeeSelfRoutes);
};
