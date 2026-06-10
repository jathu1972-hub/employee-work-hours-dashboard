export function useBlobStore() {
  return Boolean(
    process.env.USE_BLOB_DB === '1' ||
    process.env.NETLIFY === 'true' ||
    process.env.NETLIFY_DEV ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

export function useVercelStore() {
  return Boolean(process.env.VERCEL === '1' || process.env.VERCEL_ENV);
}