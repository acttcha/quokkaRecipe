**Last updated: August 18, 2026**

Quokka Recipe ("the App") values your privacy and complies with applicable laws, including Korea's Personal Information Protection Act. This policy explains the types of information the App collects, uses, and provides, and how that information is handled.

The App can be **used as a guest without logging in**. **Optional social sign-in (Apple on iOS, Google on Android)** is offered solely for the case where you want to carry your Leaf balance over when changing or reinstalling your device.

---

## 1. Information We Collect

### 1.1 Information you provide directly

- Photos of ingredients (taken with the camera or chosen from your photo library)
- Receipt photos (when used)
- Ingredient names you type in
- Dietary preferences (allergies, spiciness preference, cooking time, diet type, cooking skill, preferred food style)
- Notes and questions you write about recipes
- Photos of dishes you take for your cooking diary
- **(Optional) When you sign in**: your account email, profile (name), and account identifier (Apple on iOS, Google on Android)

### 1.2 Information collected automatically

- Device identifier — an identifier used to associate a non-logged-in guest's Leaf balance with the device
- App usage statistics — the type, count, and time of AI calls, number of ingredient scans, etc.
- Leaf balance and usage (deduction/accrual) history
- Saved recipe information (when you save a recipe with the ♥ button)
- (When ads are shown) advertising identifier and ad-related information — see 3.6 below

### 1.3 Information we do NOT collect

- Passwords — the App supports social sign-in (Apple/Google) only and does not store passwords
- Location information
- Contacts, call logs, or information from other apps on your device

---

## 2. Where Information Is Stored

Information in the App is divided by storage location as follows.

### 2.1 On-device storage

- Dietary preferences
- Saved recipes, folders, and notes
- Quokka Q&A history
- Fridge ingredient list
- Cooking diary (dish photos you take)

The above information is stored in your device's secure storage (iOS Keychain, Android KeyStore) and is not transmitted to or stored on the company's (Chasoft's) servers.

### 2.2 Server storage (Supabase)

The information below is stored on the cloud server (Supabase) used by the company for reliable Leaf management and fraud prevention.

- Leaf balance and usage (deduction/accrual) history
- AI call usage statistics (type, count, time)
- Device identifier or (when logged in) social account information (email, etc.)

This information is stored keyed by **device identifier** or **social account ID**, so that your Leaf balance is preserved when you reinstall the app on the same device or sign in from another device.

---

## 3. Provision of Information to External Services

The App uses the following external services to provide its core features.

### 3.1 Google Gemini API (AI)

- **Information transmitted**: photographed ingredient/receipt images, entered ingredient text, dietary preferences, recipe information, questions you enter
- **Purpose of use**: recognizing ingredients from images, generating recipes, answering recipe-related Q&A, analyzing captions/descriptions of YouTube videos
- **How it is transmitted**: sent to Google via the company's server (Supabase); the company does not store the request content (images/text) on its server
- **Recipient**: Google LLC (USA)
- **Privacy policy**: https://policies.google.com/privacy

### 3.2 Supabase (server infrastructure)

- **Information stored/processed**: Leaf balance and usage history, app usage statistics, device identifier, (when logged in) account information
- **Purpose of use**: Leaf wallet management, user authentication (login), AI request relay
- **Recipient**: Supabase, Inc. (USA)
- **Privacy policy**: https://supabase.com/privacy

### 3.3 Social Sign-In — Apple / Google (optional)

- **Information collected**: account email, profile (name), account identifier
- **Purpose of use**: optional login — to carry your Leaf balance over even when changing or reinstalling your device
- **Recipient**: Apple Inc. (USA, Sign in with Apple on iOS) / Google LLC (USA, Google Sign-In on Android)
- **Privacy policy**: https://www.apple.com/legal/privacy · https://policies.google.com/privacy
- With Sign in with Apple, you may choose Apple's private email relay address instead of your real email.

### 3.4 RevenueCat (in-app purchases)

- **Information transmitted**: purchase/subscription history, user identifier (device identifier or account ID)
- **Purpose of use**: managing and verifying in-app purchase/subscription status
- **Recipient**: RevenueCat, Inc. (USA)
- **Privacy policy**: https://www.revenuecat.com/privacy

### 3.5 Google YouTube Data API

- **Information transmitted**: search terms based on ingredient names
- **Purpose of use**: searching for recipe videos
- **Recipient**: Google LLC (USA)
- **Privacy policy**: https://policies.google.com/privacy

### 3.6 Google AdMob (advertising)

- **Information collected/used**: advertising identifier, device information, ad-related information such as impressions and clicks
- **Purpose of use**: serving banner and rewarded ads to free users
- **Recipient**: Google LLC (USA)
- **Privacy policy**: https://policies.google.com/technologies/ads
- Ads are not shown to Quokka Pass (subscription) users.

### 3.7 Coupang Partners

- **Information transmitted**: ingredient name (only when you click a "Buy on Coupang" link)
- **Purpose of use**: linking to the ingredient purchase page
- **Recipient**: Coupang Corp.
- **Privacy policy**: https://www.coupang.com/np/privacy

The App does not provide your information to any third party other than the services listed above.

---

## 4. Use of Permissions

The App uses the following permissions and does not use them for any other purpose without your explicit consent.

| Permission | Purpose | Required/Optional |
| --- | --- | --- |
| Camera | Photographing ingredients and receipts | Optional (gallery can be used if denied) |
| Photo Library | Selecting ingredient photos from the gallery | Optional (camera can be used if denied) |

You can change permissions at any time in your device settings.

---

## 5. Retention and Destruction of Information

### 5.1 On-device information

- **Retention period**: until you delete the app or use the "Delete all data" feature within the app
- **Method of destruction**: deleted immediately upon app deletion or reset

### 5.2 Server-stored information (Supabase)

- **Retention period**: retained for Leaf management and fraud prevention; destroyed without delay upon an account deletion request
- **Account/data deletion**: you can immediately delete your account and the data stored on the server via "My → Profile → Delete Account" in the app. If you cannot access the app, you may request deletion at the contact below (chasoft.official@gmail.com).

### 5.3 Information transmitted to external services

Governed by each external service's privacy policy.

---

## 6. Your Rights

You may exercise the following rights in the App.

- **Access**: view stored information in the "Fridge", "Saved Recipes", and "My" menus in the app
- **Correction**: edit directly in the relevant menu in the app
- **Deletion**: delete individual data, or delete everything at once via "Delete all data" in the app
- **Login/Logout**: sign in or out with your social account (Apple/Google) in the "My" menu in the app
- **Account deletion**: delete immediately via "My → Profile → Delete Account" (or request at the contact above)
- **Uninstall**: deleting the app from your device also deletes all locally stored data

---

## 7. Information of Children Under 14

The App does not knowingly collect personal information from children under the age of 14. If a child under 14 uses the App, they must do so with the consent of a legal guardian.

---

## 8. Information Security

The App takes the following measures to protect your information.

- On-device data is stored in secure storage provided by the operating system (iOS Keychain, Android KeyStore)
- Server (Supabase) data is protected by access control (row-level security, RLS); the app cannot access server data directly and processes it only through verified server functions
- Communication with external services uses HTTPS encryption
- Login uses Apple/Google social authentication (OAuth); the App does not store passwords
- The company does not separately retain, on its servers, the ingredient images and input information that pass through for AI feature delivery

---

## 9. Changes

This policy may be revised in accordance with changes in law or the service. Changes will be announced through this page, and important changes will be communicated via in-app notifications. The date of the last update is shown at the top of this document.

---

## 10. Contact

For questions about this policy or the handling of personal information, please contact us below.

- **Company**: Chasoft
- **Email**: chasoft.official@gmail.com

The App is a solo-developer app without a separate data protection officer; we will respond promptly to inquiries sent to the contact above.
