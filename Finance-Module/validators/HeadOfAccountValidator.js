import Joi from "joi";

const academicYearCreate = Joi.string().required().messages({
  "string.base": "Academic Year must be a string.",
  "string.empty": "Academic Year cannot be empty.",
  "any.required": "Academic Year is required.",
});

const academicYearUpdate = Joi.string().allow("").optional().messages({
  "string.base": "Academic Year must be a string.",
  "string.empty": "Academic Year cannot be empty.",
});

const headOfAccountName = Joi.string().required().messages({
  "string.base": "Head Of Account Name must be a string.",
  "string.empty": "Head Of Account Name cannot be empty.",
  "any.required": "Head Of Account Name is required.",
});

const HeadOfAccountValidator = Joi.object({
  headOfAccountName,
  academicYear: academicYearCreate,
});

const HeadOfAccountValidatorUpdate = Joi.object({
  headOfAccountName,
  academicYear: academicYearUpdate,
});

export default {
  HeadOfAccountValidator,
  HeadOfAccountValidatorUpdate,
};
