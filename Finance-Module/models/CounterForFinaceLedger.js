// models/Counter.js
import mongoose from "mongoose";

const CounterForFinaceLedgerSchema = new mongoose.Schema({
  schoolId: {
    type: String,
    required: true,
  },
  headOfAccountType: {
    type: String,
    enum: [
      "Assets",
      "Liabilities",
      "Income",
      "Expenditure",
      "Net Surplus/(Deficit)",
      "Capital Fund",
    ],
    required: true,
  },
  lastLedgerCode: {
    type: Number,
    required: true,
    default: 0,
  },
});

CounterForFinaceLedgerSchema.index(
  { schoolId: 1, headOfAccountType: 1 },
  { unique: true }
);

export default mongoose.model(
  "CounterForFinaceLedger",
  CounterForFinaceLedgerSchema
);
