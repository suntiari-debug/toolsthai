# Environment Variable Template for WebDev

WebDev manages secrets in the project settings rather than through a committed `.env` file. Use this reference only to verify names and formats; leave credentials in the WebDev Secrets panel.

```text
# Use the published HTTPS URL exactly, without a trailing slash.
PUBLIC_SITE_URL=https://your-actual-project-id.manus.space

# Optional analytics. Leave both empty to disable analytics loading safely.
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
```

The full-stack WebDev template injects these system variables automatically: `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, and `BUILT_IN_FORGE_API_KEY`. Confirm that they are available in the project settings before testing sign-in or storage uploads.
