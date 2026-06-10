export const getRequiredEnv = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not configured.`);
  }

  return value;
};

export const getOptionalEnv = (key: string) => {
  const value = process.env[key];

  return value && value.trim().length > 0 ? value : undefined;
};
