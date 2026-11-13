# TimC's Kitchen — iPhone and Android beta

The **standalone native Expo/React Native app** for [TimC's Kitchen](https://timcskitchen.com). This repository deliberately contains **only** the mobile application, not the private jackOS website, database, administration tools, or credentials.

## TimC's Kitchen v0.2.0 — TestFlight release

The app source is prepared for the next signed iPhone build with the existing app identity:

- Version: `0.2.0`; iOS build number baseline: `2` (the `testflight` EAS profile may automatically increment it when building).
- Bundle ID: `com.timcskitchen.mobile` — **do not create a new Apple app**.
- Apple App Store Connect ID: `6833304903`.
- Included changes: public offline recipe cache and pull-to-refresh, secure Kitchen account sign-in, favorites syncing, and owner cooking history.
- Design: existing plum-and-gold cookbook layout preserved.

**To put this build on the phone:** Open the [prefilled Expo Launch link](https://launch.dev/?github=https%3A%2F%2Fgithub.com%2Ftimchenier%2Ftimcs-kitchen-mobile&projectName=timcs-kitchen&appName=TimC%27s%20Kitchen&appBundleId=com.timcskitchen.mobile). Use the **existing Expo account and existing TimC's Kitchen Apple record**, choose iOS/TestFlight, authorize signing, review Expo's cost screen (stay within Free usage), and launch/submit. After Apple processes the signed upload, TestFlight can show an **Update** button for the existing app.

Expo Launch does **not** automatically detect commits, so rerun it for this new version. Source commits and GitHub Actions passing do not submit a native build. Only the Expo/Apple account holder can complete the signed build authorization.

**Smoke-test sequence:** Sign in to Kitchen Sync; favorite a recipe; verify its heart on timcskitchen.com; record a cook on the phone; check the same history on the website; restart offline after a successful online catalog load; return online and pull down to refresh. Confirm signed-out hearts remain local and a regular Kitchen member cannot access private cooking history.

## Launch from your browser (no Terminal)

1. Open **[Launch TimC's Kitchen in Expo](https://launch.dev/?github=https%3A%2F%2Fgithub.com%2Ftimchenier%2Ftimcs-kitchen-mobile&projectName=timcs-kitchen&appName=TimC%27s%20Kitchen&appBundleId=com.timcskitchen.mobile)**. The repository and identifiers are prefilled.
2. Paste this public GitHub URL: **https://github.com/timchenier/timcs-kitchen-mobile**.
3. Sign in to your **Expo Free** account and follow the GitHub authorization prompts.
4. Choose **iOS → TestFlight**, and select the **existing** TimC's Kitchen record in Apple App Store Connect. Do **not** create a second bundle identifier or a second app.
5. Complete Apple's authorized signing screens in Expo and review the build summary before proceeding. Share the screen or error if the existing app cannot be selected; do not enter or publish secrets in GitHub.

[Expo Launch](https://launch.expo.dev/) is in beta; the exact screens can change. A GitHub repo alone does **not** create or submit a TestFlight build. Expo and Apple authorization must be completed by the account owner.

### Existing Apple configuration

| Setting | Value |
| --- | --- |
| App name | TimC's Kitchen |
| iOS bundle identifier | `com.timcskitchen.mobile` |
| Apple Developer Team | `4ADR7ZND8C` |
| App Store Connect numeric Apple ID | `6833304903` |
| App Store Connect SKU | `TCK-IOS-001` |
| EAS iOS build profile | `testflight` |

These identifiers are configured in `app.json` and `eas.json`. **Do not share Apple passwords, session cookies, private keys, or API tokens.**

### Google Pixel test

The `preview` profile in `eas.json` produces an installable Android APK when an EAS Android build is run. Expo Launch's Android/Google Play support may be limited, so we'll verify the browser-only Android build pathway separately before promising a direct APK link. No Google Play account is required to sideload an APK.

### What this first beta includes

- Native recipe browser and searchable categories
- Recipe detail view with photos, ingredients, and timed instructions
- Interactive cook mode and checklists
- In-app cooking timers
- Share sheets and links to the existing Kitchen Studio and journal

The app retrieves **public, published** recipes from `https://timcskitchen.com/api/recipes/mobile-catalog`. It does not embed admin credentials, access private drafts, or duplicate the main Kitchen database.

**Still pending beyond Build 1:** Android APK, authenticated native Studio/favorites/journal editing, offline editing, and background timer notifications. Those capabilities require separate setup and testing.

### Next TestFlight candidate — safe reliability upgrade

This branch adds **on-device caching for the public recipe catalog** and **pull-to-refresh** on the existing recipe list. After a successful online load, saved published recipes remain readable on the device even when the API or network is temporarily unavailable. It does not store private account data or change the existing screen layout, visual styling, or server database.

This is source code for the **next** beta, not an update to the TestFlight Build 1 already on phones. Because local storage needs a native dependency, a new signed iOS build must be generated and tested before distribution. Pull-to-refresh and offline startup should be validated on an iPhone with airplane mode toggled.

### Costs

GitHub's public repositories and Expo's Free tier can be used without a new subscription. Stay on Expo's **Free** plan and do not select an upgrade or paid workflow. Free monthly quotas apply; check [Expo pricing](https://expo.dev/pricing) before creating builds. The existing Apple Developer membership is separate.

### Developers (optional)

The source is an Expo SDK 58 project; entrypoint `index.js`, main UI `App.tsx`. `npm install` can regenerate the icon from `assets/kitchen-icon.svg`. The root `app.json` and `eas.json` contain the mobile application settings. Use this repository's root as the project directory.

## Next beta: Kitchen account sync (requires backend mobile-sync route)

This opt-in feature signs into the **existing** TimC's Kitchen account through Supabase Auth, with the same password used at timcskitchen.com. No new database, account service, project, subscription, or secret key is created. The mobile package contains only a Supabase **publishable** key; it never embeds service-role or private credentials.

- Favorites are loaded from and saved into the existing Kitchen favorites table after membership approval.
- When signed out or awaiting approval, hearts stay local to this device; they are not silently imported into another person's account.
- The owner can review recent cooking sessions and intentionally add a dated cooking journal record from a recipe. Detailed notes, editing, and photos remain available on the existing website.
- Local recipe catalog caching and pull-to-refresh from the prior release remain unchanged.
- Existing design, recipe cards, and native cooking mode remain intact except for small, additive account, favorites, and journal controls.
- Auth credentials are stored with Expo SecureStore; access tokens are validated on the server on every request. The website's existing cookie-based routes are not modified.

**Deployment order:** deploy and verify the isolated `/api/recipes/mobile-sync` server route from `timchenier/jackos.live` before testing native account sign-in. Build and distribute a *new* signed TestFlight version only after both GitHub checks pass and the iPhone experience has been tested. GitHub source changes do not update the app currently installed on phones.

**Test cases:** existing account sign-in; pending-account access block; cross-account isolation; favorites round-trip web ↔ iPhone; owner-only cook history; airplane-mode offline catalog; sign-out returns to device favorites; private Studio never appears in the mobile app.
