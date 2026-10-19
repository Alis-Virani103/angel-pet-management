# User Authority and Permissions Setup

This feature uses Firebase Authentication email/password accounts, Firestore employee profiles, Firebase Security Rules, and an administrator custom claim. Application-side button and route checks improve the user experience, but the Firebase rules are the data-access boundary.

## 1. Configure Firebase

1. In Firebase Console, select the existing Angel Pet ERP project.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. In **Project settings → General**, add the web app configuration to the deployment environment as `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`.
4. Ensure the application is pointed at the same project used for the existing company data. This implementation does not migrate or delete business records.
5. For Vercel, set all six `VITE_FIREBASE_*` values in the relevant deployment environments and redeploy after changing them. The values must all come from the same Firebase web app/project. In **Authentication → Sign-in method**, enable **Email/Password**. Add the deployed hostname in **Authentication → Settings → Authorized domains**.

## Sign-in troubleshooting

- If localhost opens directly but the deployed site asks you to sign in, localhost may already have a signed-in Firebase session saved in that browser. Sign out there or open a private window to check the signed-out flow; this is not an authentication bypass.
- `auth/configuration-not-found` means the Firebase project used by the site has no usable email/password sign-in configuration. Check that Vercel's `VITE_FIREBASE_PROJECT_ID`, API key, and other web-app settings point to the same project where the employee account was created, and confirm Email/Password is enabled. After correcting Vercel environment variables, redeploy the site.
- If the settings are correct but the account is rejected, verify that the email exists in **Authentication → Users** in that same project and reset its password if necessary.

## 2. Provision the first owner

1. Create the owner account in **Authentication → Users** using the owner's work email and a secure temporary password.
2. Place a service-account JSON file with Firebase Authentication user-management permissions in a protected location outside this repository. Do not commit the JSON file or expose it to the browser.
3. In PowerShell, set the service account and project for the current terminal, then grant the admin claim:

   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\secure\firebase-admin-service-account.json'
   $env:FIREBASE_PROJECT_ID = 'your-firebase-project-id'
   npm run authority:grant-owner -- owner@example.com
   ```

4. The owner must sign out and sign back in so Firebase issues an ID token containing the new `admin` claim. This is a trusted server-side operation; the app has no self-service admin bootstrap.

## 3. Publish security rules manually

Review the repository's `firestore.rules` and `storage.rules`, then paste them into **Firestore Database → Rules** and **Storage → Rules** in Firebase Console and publish them. This implementation does not deploy rules automatically.

The rules allow the owner custom claim full access, allow employees only the actions granted in their active `userProfiles/{uid}` permission record, and deny unlisted data paths by default. Employee profiles can only be listed or changed by an admin; an employee can read their own profile. Deactivated employee profiles are denied access.

**Do not publish these rules until they have been reviewed against the exact Firebase project and existing workflows.** Until rules are published, the application-side checks alone are not a sufficient security boundary. Do not replace the rules with public access or broad signed-in-user access.

## 4. Create employee accounts

After signing in as the owner, open **User Authority** in the admin navigation. Create each employee with their work email, display name, and only the module/action permissions they need. New employees receive no module permissions unless selected. Deactivate an employee to block access, update permissions to change their access, or send a Firebase password-reset email from the employee row.

## Permission notes

- A module's **View** permission controls its page and corresponding data reads. Create, Edit, Delete, and Approve are checked separately for writes.
- Some workflows span modules. For example, recording a customer payment also updates a sales order, and receiving a purchase updates inventory. Grant the necessary permissions for each part of the workflow.
- Some create forms need related-module read access to select existing records. For example, creating a sales order needs access to customer/product data, and creating a purchase needs raw-material data. Supplier-payment actions require both Finance create and Purchases edit. The interface hides these actions when their required permissions are missing.
- Finance View also authorizes reading dispatch records for the Finance Dispatch tab; dispatch changes still require Dispatch permissions.
- The administrator custom claim bypasses employee permission checks. Employee permissions are stored in Firestore and therefore apply across sessions and devices.
- Existing local browser data is not a substitute for Firestore and is not imported into the cloud by this feature. Existing Firebase company records remain in place.
