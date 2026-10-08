# Setup guide

This guide takes you from the project folder to a working PersonalDash, one step at a time. You can stop after
any section. Running locally with demo data needs only Node.js. Sections 1 and 3 give you your own data, stored
online and reachable from your phone.

You need Node.js 22 or newer. To check, open a terminal and run `node -v`. If the command is not found, install
the LTS version from https://nodejs.org.

## Run locally without a backend

1. Open a terminal in the project folder (the folder that contains `package.json`).
2. Run `npm ci`. This installs the exact package versions in `package-lock.json`. It takes a minute or two.
3. Run `npm run dev:memory`.
4. Open http://localhost:5173 in your browser.

This mode uses demo data kept in memory. Anything you change is lost when you reload the page. It needs no
accounts, so it is the quickest way to try the app. To stop the server, press Ctrl+C in the terminal.

## 1. Supabase (free tier)

Supabase stores your data and handles sign-in. The free tier is enough for personal use.

1. Go to https://supabase.com, click **Start your project**, and sign in.
2. Click **New project**. Keep the default organization, enter a name such as `personaldash`, and choose a
   database password. Save that password in a password manager. The app does not need it. Pick the region
   closest to you, then click **Create new project**. Wait a minute or two for it to finish.
3. In the left sidebar, click **SQL Editor**, then **New query**.
4. Open `supabase/migrations/0001_init.sql` on GitHub and click **Copy raw file** (the copy icon above the file),
   so you get the whole file. Paste it into the SQL Editor and click **Run** with nothing selected (a selection
   runs only that part). This creates the tables and security rules. The script is safe to run again: anything
   that already exists is skipped. A "syntax error at or near ;" means only part of the file was pasted.
5. In the left sidebar, click **Authentication**, then **Users**. Click **Add user**, then **Create new user**.
   Enter your email address and a password. Tick **Auto Confirm User**, then click **Create user**. This account
   is the only one the app will ever have.
6. Still under **Authentication**, click **Sign In / Providers** (older dashboards call it **Providers**). Find
   **Allow new users to sign up** and switch it off. This stops anyone else from creating an account.
7. Click **Project Settings** (the gear icon at the bottom of the sidebar), then **API**. Copy the **Project URL**
   and the **anon public** key. Do not copy the `service_role` key. It must stay secret.
8. In the project folder, create a file named `.env.local`. The name starts with a dot and has no other extension.
   Put these three lines in it, replacing the example values with your own:

   ```text
   VITE_DATA_MODE=supabase
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=paste-your-anon-public-key-here
   ```

   Do not put spaces around the `=` sign. The file is git-ignored, so your keys stay out of the repository.

9. If `npm run dev` is still running, stop it with Ctrl+C. Then run `npm run dev` and open
   http://localhost:5173. Sign in with the email and password from step 5.

The anon key is safe to include in the app and to see in the browser. It is designed to be public. The migration
turns on Row Level Security for every table, so each request can only read and write the rows that belong to the
signed-in user. Keep the `service_role` key secret, and never add it to this project.

Vite reads `.env.local` only when it starts. After you change it, stop and restart `npm run dev`.

## 2. Google Calendar (optional)

The calendar integration:

- Reads events from your primary Google calendar, to show your meetings and work out how much time you really have.
- Writes all-day events only into its own calendar named "PersonalDash", and only for tasks you pin to a day. It
  does not change your other calendars.

Set up the Google side:

1. Go to https://console.cloud.google.com and sign in with your Google account.
2. Click the project picker at the top of the page, then **New project**. Name it `PersonalDash`, click
   **Create**, and select it in the picker.
3. Open the navigation menu (☰), then **APIs & Services**, then **Library**. Search for **Google Calendar API**,
   open it, and click **Enable**.
4. Under **APIs & Services**, click **OAuth consent screen**. If you see a **Get started** button, click it.
5. Set **User type** to **External**, then click **Create**.
6. Fill in **App name** as `PersonalDash`. Set **User support email** and **Developer contact information** to your
   email address. Click **Save and continue**.
7. On the **Scopes** step, click **Add or remove scopes** and add these two:
   - `https://www.googleapis.com/auth/calendar.events.readonly`
   - `https://www.googleapis.com/auth/calendar.app.created`

   Click **Update**, then **Save and continue**.

8. Leave **Publishing status** on **Testing**. Under **Test users**, click **Add users**, enter your own Google
   account, and save. Only test users can connect while the app is in Testing.
9. Under **APIs & Services**, click **Credentials**, then **Create credentials**, then **OAuth client ID**.
10. Set **Application type** to **Web application** and give it a name such as `PersonalDash web`.
11. Under **Authorized JavaScript origins**, click **Add URI** and add `http://localhost:5173`. Add your Vercel
    address, such as `https://personaldash.vercel.app`, when you have it (see section 3). Leave **Authorized
    redirect URIs** empty. No redirect URIs are needed.
12. Click **Create**. Copy the **Client ID**. It ends in `.apps.googleusercontent.com`. You do not need the client
    secret.
13. Add the Client ID to `.env.local` as `VITE_GOOGLE_CLIENT_ID=your-client-id`, then restart `npm run dev`.

Once the feature is available, connect it in the app: **Settings**, then **Connect Google Calendar**.

Two things to expect when you connect:

- Google shows a screen saying **"Google hasn't verified this app"**. This is normal for a personal app in Testing
  mode. Click **Continue**.
- The connection lasts about an hour. After that, a **Reconnect calendar** button appears. Click it to connect
  again.

## 3. Deploy on Vercel

Vercel hosts the app online, so you can open it from any device.

1. Push this project to a GitHub repository, if you have not already done so.
2. Go to https://vercel.com and click **Sign Up** or **Log In**. Choose **Continue with GitHub**, and allow Vercel
   to access your GitHub account.
3. On the Vercel dashboard, click **Add New…**, then **Project**.
4. Find the PersonalDash repository in the list and click **Import**. If it does not appear, click
   **Adjust GitHub App Permissions** and allow Vercel to access that repository.
5. Check that **Framework Preset** shows **Vite**. The build settings come from `vercel.json`, so leave them as they
   are.
6. Open **Environment Variables** and add each of these, one at a time. Enter the name and value, then click **Add**.
   - `VITE_DATA_MODE` with the value `supabase`
   - `VITE_SUPABASE_URL` with your Project URL
   - `VITE_SUPABASE_ANON_KEY` with your anon public key
   - `VITE_GOOGLE_CLIENT_ID` with your Client ID. You can leave this out until you set up Google Calendar, then
     add it and redeploy.
7. Click **Deploy** and wait for it to finish. Copy the address Vercel gives you, such as
   `https://personaldash.vercel.app`.
8. Supabase needs to know your address. In Supabase, click **Authentication**, then **URL Configuration**. Set
   **Site URL** to your Vercel address, then click **Save**.
9. If you set up Google Calendar, go to Google Cloud Console, then **APIs & Services**, then **Credentials**. Open
   your OAuth client, add your Vercel address under **Authorized JavaScript origins**, and save.
10. Open your Vercel address and sign in.

Vite places environment variables into the app when it builds, not when it runs. If you change a variable on
Vercel later, open the project, go to **Deployments**, open the menu (⋯) on the latest deployment, and click
**Redeploy**.

## Troubleshooting

- **Blank page, or "must be set in supabase mode" in the console.** The app is in Supabase mode but a value is
  missing. Open the browser console (F12, or right-click and choose **Inspect**, then **Console**). Check that
  `.env.local` uses the exact names shown in section 1 and has no spaces around `=`. Restart `npm run dev`. On
  Vercel, check the variables under **Settings → Environment Variables**, then redeploy.
- **You see demo projects instead of your own.** `VITE_DATA_MODE` is not set to `supabase`. Fix it in
  `.env.local` (or on Vercel), then restart or redeploy.
- **"Invalid login credentials".** The email or password does not match the user in Supabase. Check both for typos.
  Under **Authentication → Users**, confirm your user exists. To change the password, open the user there.
- **Errors that mention "row-level security", "new row violates row-level security policy", or "permission
  denied".** The database migration has probably not run. Run `supabase/migrations/0001_init.sql` in the SQL Editor
  (section 1, step 4). Also make sure you are signed in.
- **Google "origin mismatch" error (Error 400: origin_mismatch).** The address you are using is missing from
  **Authorized JavaScript origins**. Add it exactly, with `https://` or `http://`, no trailing slash, and the port
  (`:5173` for local development).
- **Google "403 access_denied" or "Access blocked".** Your Google account is not a test user. Open the **OAuth
  consent screen**, add your account under **Test users**, and try again.
