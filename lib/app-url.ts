export function appUrl(path: string, request: Request) {
  const configuredOrigin = process.env.CLOUD_RUN_SERVICE_URL?.trim();
  return new URL(path, configuredOrigin || request.url);
}
