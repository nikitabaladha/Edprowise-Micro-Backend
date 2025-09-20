import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";

import BSPLLedger from "../../models/BSPLLedger.js";
import DepreciationMaster from "../../models/DepreciationMaster.js";
import moment from "moment";

// see i want only that BSPLLedger which has BSPLLedgerName === Fixed Assets
// now i want to group all groupLedger which is under that Fixed Assets BSPLLedger
// from that i want groupLedger,from Depriciation master the rateAsPerIncomeTaxAct for that perticular groupLedgerId, openingBalance, Total Addition
// for OpeningBalance i want sum of all ledger which comes under that perticular groupLedger
// for Total Addition i need sumOfDebit, sumOfCredit and then sumOfDebit-sumOfCredit

// example:
// entryDate	HeadofAccount	BS&P&LLedger	GroupLedger	        Ledger               OpeningBalance.  debit  credit.  closingBalance
// 19-09-2025	Assets	      Fixed Assets	Furniture&Fixture	  ElectricalEquipemts  1000             100    0        1100
// 19-09-2025	Assets	      Fixed Assets	Furniture&Fixture	  ElectricalEquipemts  1100             100    0        1200
// 19-09-2025	Assets	      Fixed Assets	Plant&Machinery	    WaterCooler&Filter   1000             0      100      900
// 19-09-2025	Assets	      Fixed Assets	Plant&Machinery	    WaterCooler&Filter   900              0      100      800

// so in response you need to give me data like

// [
//     {
//         "bSPLLedgerId": "6888dae7481f4c4cfb3716c3",
//         "bSPLLedgerName": "Non Current Liabilities",
//         "groupLedgers": [
//             {
//                 "groupLedgerId": "6888dae7481f4c4cfb3716d9",
//                 "groupLedgerName": "Water Cooler & Filter",
//                 "rate":20,
//                 openingBalance:1000
//                 closingBalance:1200
//                 "totalAddition":(100+100=200)-(0+0=0)=200
//             },
//             {
//                 "groupLedgerId": "6888dae7481f4c4cfb3716df",
//                 "Electrical Equipemts": "Plant&Machinery",
//                "rate":10,
//                openingBalance:1000
//                closingBalance:800
//                "totalAddition":(0+0=0)-(100+100=200)=-200
//             },
//         ]
//     },
// ]

// tell me how to do it

async function getFixedAssetsSchedule(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const { startDate, endDate, academicYear } = req.query;

    // Validate required parameters
    if (!academicYear) {
      return res.status(400).json({
        hasError: true,
        message: "academicYear is a required parameter.",
      });
    }

    // Parse date range or use academic year range
    const academicYearStart = moment(
      `04/01/${academicYear.split("-")[0]}`,
      "MM/DD/YYYY"
    ).startOf("day");
    const academicYearEnd = moment(
      `03/31/${academicYear.split("-")[1]}`,
      "MM/DD/YYYY"
    ).endOf("day");

    // Normalize query range
    const start = startDate
      ? moment(startDate).startOf("day")
      : academicYearStart.clone();
    const end = endDate
      ? moment(endDate).endOf("day")
      : academicYearEnd.clone();

    // Validate date range
    if (end.isBefore(start)) {
      return res.status(400).json({
        hasError: true,
        message: "End date cannot be before start date.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Fixed Assets Schedule fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching Fixed Assets Schedule:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getFixedAssetsSchedule;
