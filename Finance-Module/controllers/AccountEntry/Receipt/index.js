import createReceipt from "./create.js";
import getAllReceiptBySchoolId from "./getAllBySchoolId.js";
import cancelReceiptById from "./cancelById.js";
import updateReceiptById from "./updateById.js";
import updateApprovalStatusById from "./updateApprovalStatusById.js";

import updateDraftReceiptById from "./updateDraftById.js";
import dreaftReceipt from "./draft.js";

import getAllLedgerByNameWithTDSorTCS from "./getAllByNameWithTDSTCS.js";

export {
  createReceipt,
  getAllReceiptBySchoolId,
  cancelReceiptById,
  updateReceiptById,
  dreaftReceipt,
  updateDraftReceiptById,
  updateApprovalStatusById,
  getAllLedgerByNameWithTDSorTCS,
};
