import EdprowiseBankDetailRoutes from "./bank-detail.js";

export default (app) => {
  app.use("/api", EdprowiseBankDetailRoutes);
};
