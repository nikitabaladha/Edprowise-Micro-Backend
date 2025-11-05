import mongoose from "mongoose";

const GroupLedgerSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    headOfAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HeadOfAccount",
      required: true,
    },
    bSPLLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BSPLLedger",
      required: true,
    },
    groupLedgerName: {
      type: String,
      required: true,
    },
    financialYear: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

GroupLedgerSchema.index(
  {
    schoolId: 1,
    headOfAccountId: 1,
    bSPLLedgerId: 1,
    groupLedgerName: 1,
    financialYear: 1,
  },
  { unique: true }
);

export default mongoose.model("GroupLedger", GroupLedgerSchema);

// here i want that as soon as my data base run i want to generate finance module yaer if not present and
// and i want to store some data in

// HeadOfAccount BsplLedger      Group Ledegr     Ledger

// Assets        Current Assets  Loan & Advances.  Cheque
// Assets        Current Assets  Loan & Advances.  Online
// Assets	       Current Assets	 Cash	             Cash Account
// Income	       School Fees	   School Fees	     Registration Fee
// Income	       School Fees	   School Fees	     Admission Fee
// Income	       School Fees	   School Fees	     Transfer Certificate Fee
// Income	       School Fees	   School Fees	     Board Exam Fee
// Income	       School Fees	   School Fees	     Board Registration Fee

// so basically all of this will be generated automatically so what to do
