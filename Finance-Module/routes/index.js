import ledgerRoutes from "./Ledger.js";
import vendorRoutes from "./Vendor.js";
import TDSTCSRateChartRoutes from "./TDSTCSRateChart.js";
import PaymentEntryRoutes from "./PaymentEntry.js";

export default (app) => {
  app.use("/api", ledgerRoutes);
  app.use("/api", vendorRoutes);
  app.use("/api", TDSTCSRateChartRoutes);
  app.use("/api", PaymentEntryRoutes);
};
