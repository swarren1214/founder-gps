export function getAuthServiceUrl(): string {
  return (
    process.env.AUTH_SERVICE_URL ??
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ??
    "http://localhost:4005"
  );
}
