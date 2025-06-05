import RequestForDemoRoutes from "./RequestForDemoRoutes.js";
import ContactUsFormRoutes from "./ContactUsFormRoutes.js";

export default (app) => {
  app.use("/api", RequestForDemoRoutes);
  app.use("/api", ContactUsFormRoutes);
};
