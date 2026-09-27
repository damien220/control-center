import {
  loadLocalEnvironment,
  readOrCreateAccessToken,
  resolveDataDirectory,
} from "./paths.mjs";

loadLocalEnvironment();
const rotate = process.argv.includes("--rotate");
const portArgument = process.argv.find((value) => value.startsWith("--port="));
const port = Number(portArgument?.split("=")[1] || process.env.PORT || 3000);

if (rotate && process.env.CONTROL_CENTER_ACCESS_TOKEN?.trim()) {
  console.error(
    "CONTROL_CENTER_ACCESS_TOKEN is set, so the token file is not used. Change that value instead.",
  );
  process.exit(1);
}
const token = readOrCreateAccessToken(resolveDataDirectory(), { rotate });
if (rotate)
  console.log("Rotated the access token. Every browser must sign in again.\n");
console.log(`Access token: ${token}`);
console.log(`Sign-in URL:  http://127.0.0.1:${port}/#token=${encodeURIComponent(token)}`);
console.log(
  "\nScripted callers can send it as: Authorization: Bearer <token>. Keep it private.",
);
