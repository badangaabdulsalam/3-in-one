Netlify deployment notes

This project is configured to deploy the static frontend to Netlify and use a serverless function to forward orders via SendGrid.

Steps:

1. Push this repo to GitHub.

2. On Netlify, connect the repo and set the publish directory to `public`.

3. Add the following Environment Variables in Netlify Site settings -> Build & deploy -> Environment:
   - `SENDGRID_API_KEY` - your SendGrid API key
   - `SENDGRID_TO` - the email address that will receive order notifications
   - `SENDGRID_FROM` - optional; defaults to `SENDGRID_TO` if not set

4. The order checkout function is at `/.netlify/functions/checkout`. When a customer checks out the site will email you the order and return an order id.

Notes:
- Order tracking is disabled in this Netlify-only setup because server-side order storage is not available.
- If you prefer persistent order storage, deploy your backend to a persistent host (Fly.io, Render, Oracle) or add a database (Supabase/Airtable) and modify the function accordingly.
