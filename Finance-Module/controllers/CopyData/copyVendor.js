import Vendor from "../../models/Vendor.js";

const copyVendors = async (
  schoolId,
  newFinancialYear,
  prevFinancialYear,
  session
) => {
  const previousVendors = await Vendor.find({
    schoolId,
    financialYear: prevFinancialYear,
  }).session(session);

  const newVendors = previousVendors.map((vendor) => ({
    schoolId,
    vendorCode: vendor.vendorCode,
    nameOfVendor: vendor.nameOfVendor,
    email: vendor.email,
    contactNumber: vendor.contactNumber,
    panNumber: vendor.panNumber,
    gstNumber: vendor.gstNumber,
    address: vendor.address,
    state: vendor.state,
    nameOfAccountHolder: vendor.nameOfAccountHolder,
    nameOfBank: vendor.nameOfBank,
    ifscCode: vendor.ifscCode,
    accountNumber: vendor.accountNumber,
    accountType: vendor.accountType,
    financialYear: newFinancialYear,
  }));

  if (newVendors.length > 0) {
    await Vendor.insertMany(newVendors, { session });
  }

  return newVendors.length;
};

export default copyVendors;
