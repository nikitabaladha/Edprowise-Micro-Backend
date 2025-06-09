import PDFRoutes from "./pdf-for-frontend.js";
import PrepareQuoteRoutes from "./prepare-quote-by-seller.js";
import SubmitQuoteRoutes from "./submit-quote-by-seller.js";
import QuoteProposalRoutes from "./quote-proposal.js";
import RejectQuoteRoutes from "./quote-acceptance-status.js";

import InterServiceCommunication from "./inter-service-communication.js";

export default (app) => {
  app.use("/api", PDFRoutes);
  app.use("/api", PrepareQuoteRoutes);
  app.use("/api", SubmitQuoteRoutes);
  app.use("/api", QuoteProposalRoutes);
  app.use("/api", RejectQuoteRoutes);

  app.use("/api", InterServiceCommunication);
};
