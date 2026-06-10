export function useBlobStore() {
  return Boolean(
    process.env.USE_BLOB_DB === '1' ||
    process.env.NETLIFY === 'true' ||
    process.env.NETLIFY_DEV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}