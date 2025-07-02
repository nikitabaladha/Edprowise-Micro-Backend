import ledgerRoutes from "./Ledger.js";
import vendorRoutes from "./Vendor.js";

export default (app) => {
  app.use("/api", ledgerRoutes);
  app.use("/api", vendorRoutes);
};
