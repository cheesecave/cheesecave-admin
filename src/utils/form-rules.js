// Validation rules shared by the admin forms (Element Plus async-validator rules).

export const requiredRule = (label) => ({
  required: true,
  whitespace: true,
  message: `${label} is required`,
  trigger: "blur",
});

// Empty values pass: pair with requiredRule when the field is mandatory.
const patternRule = (test, message) => ({
  validator: (_rule, value, callback) =>
    callback(!value || test(String(value)) ? undefined : new Error(message)),
  trigger: "blur",
});

export const emailRule = patternRule(
  (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  "Enter a valid e-mail address",
);

export const httpUrlRule = patternRule(
  (value) => /^https?:\/\/[^\s/]+\S*$/.test(value),
  "Enter an http:// or https:// URL",
);
