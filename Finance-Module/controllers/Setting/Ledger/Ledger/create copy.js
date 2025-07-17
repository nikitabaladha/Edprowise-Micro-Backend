import Ledger from "../../../../models/Ledger.js";
import LedgerValidator from "../../../../validators/LedgerValidator.js";

// i want that if HeadOfAccountName of that perticular headOfAccountId is
// Assets  then the ledgerCode will be : 1001, 1002, 1003 etc
// Liabilities then the ledgerCode will be : 2001, 2002, 2003 etc
// Income then the ledgerCode will be :3001 , 3002, 3003 etc
// Expenditure then the ledgerCode will be :4001, 4002, 4003 etc
// but you need to find for that perticualr schoolId

// I am providing you the example for example for Income

// academicYear 2025-2026

// Head Of Account	  BS & PL Ledger	     Group Ledger	     Ledger          ledgerCode
// Income	             School Fees	       Tuition Fee	     Tuition Fee     3001
// Income	             School Fees	       Annual Fee	       Annual Fee      3002
// Income	             School Fees	       Composite Fee	   Composite Fee   3003

// academicYear 2026-2027

// Head Of Account	  BS & PL Ledger	     Group Ledger	     Ledger          ledgerCode
// Income	             School Fees	       Tuition Fee	     Tuition Fee     3004
// Income	             School Fees	       Annual Fee	       Annual Fee      3005
// Income	             School Fees	       Composite Fee	   Composite Fee   3006

// if academic year change, still the new record will continue from previous record ledgerCode

// but the problem is that if someone delete some record then i can keep track for that?
// if someone delete some record then i can keep track for that?

// like see if some one delete record still the next record must be the new one not the previous one

// for example if record for 2026-2027
// Head Of Account	  BS & PL Ledger	    Group Ledger	   Ledger          ledgerCode
// Income	            School Fees	       Composite Fee	   Composite Fee   3006             if this delete still also when
// i add new record it must store ledgerCode 3007 not 3006
// are you getting what i am trying to say?

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to create a ledger.",
      });
    }

    const { error } = LedgerValidator.LedgerValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const {
      ledgerName,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      openingBalance,
      academicYear,
    } = req.body;

    const newLedger = new Ledger({
      schoolId,
      headOfAccountId,
      groupLedgerId,
      bSPLLedgerId,
      ledgerName,
      openingBalance: openingBalance ?? 0,
      academicYear,
    });

    await newLedger.save();

    return res.status(201).json({
      hasError: false,
      message: "Ledger created successfully!",
      data: newLedger,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Ledger already exists.`,
      });
    }

    console.error("Error Creating Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
