# Expo App

React Native mobile app with Firebase Authentication, built with Expo.

## Prerequisites

Before running the app, you need Firebase configuration files from Terraform:

```bash
# From the infra/ directory, after running terraform apply:
cd ../infra

# Download iOS config
terraform output -json firebase_ios_config | jq -r '.config_file_contents' | base64 -d > ../expo-app/GoogleService-Info.plist

# Download Android config
terraform output -json firebase_android_config | jq -r '.config_file_contents' | base64 -d > ../expo-app/google-services.json
```

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Generate native projects (required for Firebase)

   ```bash
   npm run prebuild
   ```

3. Run the app

   ```bash
   # iOS (requires macOS with Xcode)
   npm run ios

   # Android (requires Android Studio)
   npm run android
   ```

## Project Structure

```
app/
├── (auth)/           # Auth screens (login, signup)
├── (app)/            # Protected screens (requires auth)
├── components/       # Shared components (AuthProvider)
├── lib/firebase/     # Firebase utilities
│   ├── config.ts     # Firebase initialization
│   ├── auth.ts       # Auth functions
│   ├── firestore.ts  # Firestore utilities
│   └── errors.ts     # Error message helpers
└── _layout.tsx       # Root layout with AuthProvider
```

## Development with Expo Go (Limited)

Note: Firebase native modules require a development build. Expo Go won't work with this setup.

For development without Firebase, you can use `npm run ios:dev` or `npm run android:dev` with Expo Go, but auth features will not work.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
