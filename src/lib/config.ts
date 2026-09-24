// Shared by browser and server. Secrets (passwords, DB, Blob token) live only in server env vars.
export const QUOTE_VALID_MS = 60 * 60 * 1000; // 1 hour
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // original file; it's resized in the browser before upload
export const QUOTES_REFRESH_MS = 15000; // staff screen polls for new quotes
