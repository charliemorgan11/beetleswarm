# Beetle Swarm — iPhone launch

Prepared 6 September 2026. **Not uploaded, submitted or released on the App Store.**

The existing web release is preserved. The iPhone source packages that same game and its fonts/artwork into an offline WKWebView app, in portrait, with full-screen play and automatic pause on app switching. No external code or assets are loaded. The native source and cloud workflow have not been compiled on macOS or tested on an iPhone in this environment. Packaging checks and the existing gameplay regression suite can run here.

## Apple account

The owner has reported completing Apple Developer setup. The Apple team and App Store Connect connection have not been verified from this repository. Use the existing membership for the next steps. Do not share your Apple password or two-factor codes in chat.

https://developer.apple.com/help/account/membership/enrolling-in-the-app/

## Build route without owning a laptop

`codemagic.yaml` prepares and archives the iPhone app on a hosted Mac. It has not been connected or executed. Connect the owner-controlled repository `https://github.com/charliemorgan11/beetleswarm` to Codemagic. The repository includes the complete game, artwork, font licenses, native source and launch drafts. The prepared export also includes a GitHub Actions unsigned simulator compilation check. It runs when this source is pushed to main. Check its latest run before treating native compilation as verified. GitHub repository access was connected after the initial upload attempt.

1. Confirm the publisher and register the proposed bundle identifier `uk.co.cm95.beetleswarm` in the correct Apple team, or update it in both `ios/project.yml` and `codemagic.yaml`. No identifier has been reserved.
2. Create an iOS app record in App Store Connect using the bundle ID and listing draft. Select price and territories; do not assume worldwide compliance or free pricing.
3. In Codemagic, connect the source repository. Add an App Store Connect integration named `Beetle Swarm Apple`, and an Apple Distribution certificate and App Store provisioning profile for the bundle ID. Enter keys in the build service's protected settings, never commit them.
4. Run `ios-build`. It bundles the existing game, runs packaging/gameplay tests, generates the project with XcodeGen, applies signing profiles and creates an IPA. The workflow uploads a successful archive to App Store Connect but does not submit to beta review or App Review. A first build is only a candidate until verified. If the app already has uploaded builds, advance the build number beyond Apple's latest number before uploading.
5. Verify the signed app through TestFlight on a real iPhone. Check first launch in airplane mode; notch/home indicator clearance; swipes in four directions; trail capture; 80% progression; all three lost lives; pause/resume; app switching/locking; relaunch; legal links; font/artwork loading. Capture genuine device or simulator screenshots after the native app is working. No App Store screenshots have been fabricated.
6. Publish the privacy/support draft on a public HTTPS site, verify those URLs, confirm the support contact and publisher information, fill the updated age-rating questionnaire and other applicable App Store forms, add actual screenshots and select the tested build. Submit for Apple's review. Publication depends on approval.

Apple currently requires uploads built with Xcode 26 or later and the iOS 26 SDK or later. The minimum supported device OS in this source is iOS 16; SDK and device minimum are different settings.

https://developer.apple.com/news/upcoming-requirements/
https://docs.codemagic.io/yaml-quick-start/building-a-native-ios-app/

## Source preparation

```bash
node scripts/prepare-ios.mjs
node --test tests/engine.test.mjs tests/ios-package.test.mjs
xcodegen generate --spec ios/project.yml --project ios
```

The last command needs XcodeGen on macOS. Generated Web resources and Xcode project are ignored; the tracked source, project specification, icon and preparation script are sufficient to reproduce them. Native app version is 1.0.0, initial build 1. No tracking or required-reason API is used directly by the current native code. Re-audit the final archive and every dependency before making Apple's privacy declaration.

The menu's draft support email is `charlie@cm95.co.uk`, a previously supplied business address. Confirm it as the public game support contact before release. No email has been sent. Store artwork and font licenses are inherited from the existing game; final publisher rights confirmation remains part of submission.
