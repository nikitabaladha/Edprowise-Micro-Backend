import Joi from "joi";

const HeadOfAccountValidator = Joi.object({
  headOfAccountName: Joi.string().required().messages({
    "string.base": "Head Of Account Name must be a string.",
    "string.empty": "Head Of Account Name cannot be empty.",
    "any.required": "Head Of Account Name is required.",
  }),
});

export default {
  HeadOfAccountValidator,
};
