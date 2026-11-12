# TimC's Kitchen — iPhone and Android beta

The **standalone native Expo/React Native app** for [TimC's Kitchen](https://timcskitchen.com). This repository deliberately contains **only** the mobile application, not the private jackOS website, database, administration tools, or credentials.

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

**Not yet shipped:** signed TestFlight IPA, Android APK, offline recipe storage, authenticated native Studio/favorites/journal editing, or background timer notifications. Those capabilities require separate setup and testing.

### Costs

GitHub's public repositories and Expo's Free tier can be used without a new subscription. Stay on Expo's **Free** plan and do not select an upgrade or paid workflow. Free monthly quotas apply; check [Expo pricing](https://expo.dev/pricing) before creating builds. The existing Apple Developer membership is separate.

### Developers (optional)

The source is an Expo SDK 58 project; entrypoint `index.js`, main UI `App.tsx`. `npm install` can regenerate the icon from `assets/kitchen-icon.svg`. The root `app.json` and `eas.json` contain the mobile application settings. Use this repository's root as the project directory.
