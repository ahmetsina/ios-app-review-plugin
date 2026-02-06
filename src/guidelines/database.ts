import type { GuidelineEntry } from './types.js';

/**
 * Static database of Apple App Store Review Guidelines.
 * Keyed by guideline section number (e.g., "2.5.1").
 */
export const GUIDELINES: Record<string, GuidelineEntry> = {
  '1.2': {
    section: '1.2',
    title: 'User Generated Content',
    excerpt:
      'Apps with user-generated content must include a method for filtering objectionable material, a mechanism to report offensive content, and the ability to block abusive users.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#user-generated-content',
    category: 'safety',
    severityWeight: 8,
  },
  '2.1': {
    section: '2.1',
    title: 'App Completeness',
    excerpt:
      'Submissions must be final versions with all necessary metadata and URLs fully functional. Apps with placeholder text, empty URLs, or other temporary content will be rejected.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#app-completeness',
    category: 'performance',
    severityWeight: 9,
  },
  '2.3': {
    section: '2.3',
    title: 'Accurate Metadata',
    excerpt:
      'Apps must have accurate metadata including descriptions, screenshots, and previews that clearly reflect the app. Do not include placeholder or irrelevant content.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#accurate-metadata',
    category: 'performance',
    severityWeight: 7,
  },
  '2.3.7': {
    section: '2.3.7',
    title: 'Accurate Metadata - App Name',
    excerpt:
      'Choose a unique app name, assign relevant keywords, and provide accurate metadata. App names must be limited to 30 characters and should not include prices, terms, or descriptions that are not the name of the app.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#accurate-metadata',
    category: 'performance',
    severityWeight: 6,
  },
  '2.4.1': {
    section: '2.4.1',
    title: 'Hardware Compatibility',
    excerpt:
      'Apps should work on all device sizes and orientations declared as supported. Universal apps must support both iPhone and iPad, including Multitasking on iPad.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#hardware-compatibility',
    category: 'performance',
    severityWeight: 6,
  },
  '2.5.1': {
    section: '2.5.1',
    title: 'Software Requirements',
    excerpt:
      'Apps must use public APIs and run on the currently shipping OS. Apps that use non-public APIs, private frameworks, or deprecated technologies will be rejected. Apps must support IPv6 networking.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#software-requirements',
    category: 'performance',
    severityWeight: 9,
  },
  '2.5.4': {
    section: '2.5.4',
    title: 'Security',
    excerpt:
      'Apps must use appropriate security measures. Apps that attempt to access or modify the device in unauthorized ways, disable security features, or use weak cryptography may be rejected.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#software-requirements',
    category: 'performance',
    severityWeight: 8,
  },
  '2.5.6': {
    section: '2.5.6',
    title: 'Background Execution',
    excerpt:
      'Apps that run background processes must use the appropriate background modes and must not misuse background execution to drain battery or consume excessive resources.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#software-requirements',
    category: 'performance',
    severityWeight: 5,
  },
  '3.1.1': {
    section: '3.1.1',
    title: 'In-App Purchase',
    excerpt:
      'Apps offering digital content, subscriptions, or premium features must use in-app purchase. Each IAP must have complete metadata, a review screenshot, and accurate pricing.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#in-app-purchase',
    category: 'business',
    severityWeight: 9,
  },
  '3.1.2': {
    section: '3.1.2',
    title: 'Subscriptions',
    excerpt:
      'Auto-renewable subscriptions must provide ongoing value. Apps must clearly explain the subscription terms, pricing, and cancellation process before purchase.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#subscriptions',
    category: 'business',
    severityWeight: 8,
  },
  '3.2.2': {
    section: '3.2.2',
    title: 'Unacceptable Business Model',
    excerpt:
      'Apps should not create an alternative app store or facilitate distribution of software outside the App Store. Apps cannot offer features that rely solely on third-party purchasing.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#other-business-model-issues',
    category: 'business',
    severityWeight: 10,
  },
  '4.0': {
    section: '4.0',
    title: 'Design',
    excerpt:
      'Apps must include a complete set of app icons in all required sizes. Icons must be unique and clearly represent the app without misleading imagery.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#design',
    category: 'design',
    severityWeight: 7,
  },
  '4.1': {
    section: '4.1',
    title: 'Copycats',
    excerpt:
      'Apps that are simply copies of another app or are substantially similar in concept, appearance, and functionality to an existing app will be rejected.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#copycats',
    category: 'design',
    severityWeight: 10,
  },
  '4.2': {
    section: '4.2',
    title: 'Minimum Functionality',
    excerpt:
      'Your app should include features, content, and UI that elevate it beyond a repackaged website. Apps that are not useful, unique, or app-like may be rejected.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#minimum-functionality',
    category: 'design',
    severityWeight: 8,
  },
  '4.6': {
    section: '4.6',
    title: 'Launch Screen',
    excerpt:
      'Apps must include a launch screen (or launch storyboard) that provides a seamless transition into the app. The launch screen should not include advertising or branding beyond a simple logo.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#apple-sites-and-services',
    category: 'design',
    severityWeight: 5,
  },
  '5.1.1': {
    section: '5.1.1',
    title: 'Data Collection and Storage',
    excerpt:
      'Apps that collect user or device data must have a privacy policy and must declare all data collection in the privacy manifest. Apps must request user consent before collecting personal data and must include required usage description strings.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage',
    category: 'legal',
    severityWeight: 9,
  },
  '5.1.2': {
    section: '5.1.2',
    title: 'Data Use and Sharing',
    excerpt:
      'Apps may not share user data with third parties without user consent. Data collected for one purpose may not be repurposed without consent. Apps must comply with applicable privacy laws.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing',
    category: 'legal',
    severityWeight: 9,
  },
  '5.1.4': {
    section: '5.1.4',
    title: 'Kids Category',
    excerpt:
      'Apps in the Kids category must not include third-party advertising or analytics, must not transmit data to third parties, and must comply with applicable children\u2019s privacy laws such as COPPA.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#kids',
    category: 'legal',
    severityWeight: 10,
  },
  '5.2.1': {
    section: '5.2.1',
    title: 'Intellectual Property - General',
    excerpt:
      'Apps must not infringe on third-party intellectual property rights. If your app uses copyrighted content, trademarks, or patented technology from others, you must have the necessary rights.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#intellectual-property',
    category: 'legal',
    severityWeight: 8,
  },
  'hig-accessibility': {
    section: 'hig-accessibility',
    title: 'Human Interface Guidelines - Accessibility',
    excerpt:
      'Apps should support accessibility features including Dynamic Type, VoiceOver, and sufficient color contrast. All interactive elements should have accessibility labels.',
    url: 'https://developer.apple.com/design/human-interface-guidelines/accessibility',
    category: 'design',
    severityWeight: 5,
  },
  'hig-app-icons': {
    section: 'hig-app-icons',
    title: 'Human Interface Guidelines - App Icons',
    excerpt:
      'Every app must supply app icons in all required sizes. Icons should be simple, recognizable, and consistent across platforms. Avoid including text in icons.',
    url: 'https://developer.apple.com/design/human-interface-guidelines/app-icons',
    category: 'design',
    severityWeight: 6,
  },
  'hig-launch-screens': {
    section: 'hig-launch-screens',
    title: 'Human Interface Guidelines - Launch Screens',
    excerpt:
      'A launch screen appears the moment your app starts and is quickly replaced by the first screen. Design it to be nearly identical to the first screen of your app for a seamless experience.',
    url: 'https://developer.apple.com/design/human-interface-guidelines/launching',
    category: 'design',
    severityWeight: 4,
  },
  '1.4.1': {
    section: '1.4.1',
    title: 'Physical Harm',
    excerpt:
      'Medical apps that provide inaccurate data or information could lead to patient harm. Apps must clearly disclaim that they are not intended to replace professional medical advice.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#physical-harm',
    category: 'safety',
    severityWeight: 9,
  },
  '2.3.1': {
    section: '2.3.1',
    title: 'Accurate Metadata - Hidden Features',
    excerpt:
      'Apps should not include hidden or undocumented features. All features must be clearly described in the app metadata and accessible during review.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#accurate-metadata',
    category: 'performance',
    severityWeight: 7,
  },
  '3.1.3': {
    section: '3.1.3',
    title: 'Other Purchase Methods',
    excerpt:
      'Apps may not use their own mechanisms to unlock content or functionality, such as license keys, augmented reality markers, QR codes, etc., unless the purchase was made through in-app purchase or the App Store.',
    url: 'https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods',
    category: 'business',
    severityWeight: 8,
  },
};

/**
 * Maps issue IDs from analyzers to their corresponding guideline sections.
 * Used by GuidelineMatcher to enrich issues with guideline references.
 */
export const ISSUE_GUIDELINE_MAP: Record<string, string[]> = {
  // Code scanner - IPv6 compatibility
  'hardcoded-ipv4': ['2.5.1'],

  // Private API usage
  'private-underscore-selector': ['2.5.1'],
  'private-class-from-string': ['2.5.1'],
  'private-perform-selector': ['2.5.1'],
  'private-value-for-key': ['2.5.1'],
  'private-dlopen': ['2.5.1'],
  'private-dlsym': ['2.5.1'],
  'private-objc-msgsend': ['2.5.1'],
  'private-iokit': ['2.5.1'],
  'private-statusbar': ['2.5.1'],
  'private-sandbox-escape': ['2.5.1'],
  'private-url-scheme': ['2.5.1'],

  // Security issues
  'security-md5': ['2.5.4'],
  'security-sha1': ['2.5.4'],
  'security-des': ['2.5.4'],
  'security-ecb-mode': ['2.5.4'],
  'security-userdefaults-sensitive': ['2.5.4'],
  'security-userdefaults-sensitive-set': ['2.5.4'],
  'security-insecure-random': ['2.5.4'],
  'security-keychain-accessible-always': ['2.5.4'],
  'security-keychain-accessible-always-this-device': ['2.5.4'],
  'security-clipboard-sensitive': ['2.5.4'],
  'security-sql-injection': ['2.5.4'],
  'security-logging-sensitive': ['2.5.4'],
  'security-hardcoded-encryption-key': ['2.5.4'],
  'security-webview-js-injection': ['2.5.4'],
  'security-disabled-ssl': ['2.5.4'],
  'insecure-http': ['2.5.4'],
  'ats-allows-arbitrary-loads': ['2.5.4'],

  // Placeholder / inaccurate metadata
  'placeholder-text': ['2.3'],
  'uiux-placeholder-text': ['2.3'],
  'asc-name-placeholder': ['2.3'],
  'asc-subtitle-placeholder': ['2.3'],

  // App name metadata
  'asc-name-too-long': ['2.3.7'],
  'asc-missing-name': ['2.3.7'],

  // Deprecated APIs
  'deprecated-uiwebview': ['2.5.1'],
  'deprecated-uialertview': ['2.5.1'],
  'deprecated-uiactionsheet': ['2.5.1'],
  'deprecated-uipopovercontroller': ['2.5.1'],
  'deprecated-uisearchdisplaycontroller': ['2.5.1'],
  'deprecated-uitableviewrowaction': ['2.5.1'],
  'deprecated-nsurlconnection': ['2.5.1'],
  'deprecated-abaddressbook': ['2.5.1'],
  'deprecated-addressbookui': ['2.5.1'],
  'deprecated-mpmovieplayercontroller': ['2.5.1'],
  'deprecated-mpmovieplayerviewcontroller': ['2.5.1'],
  'deprecated-alassetslibrary': ['2.5.1'],
  'deprecated-uilocalnotification': ['2.5.1'],
  'deprecated-uiusernotificationsettings': ['2.5.1'],
  'deprecated-uiaccelerometer': ['2.5.1'],
  'deprecated-openurl-sync': ['2.5.1'],
  'deprecated-statusbar-style': ['2.5.1'],
  'deprecated-statusbar-hidden': ['2.5.1'],
  'deprecated-statusbar-orientation': ['2.5.1'],
  'deprecated-nsstring-drawing': ['2.5.1'],
  'deprecated-addressbook': ['2.5.1'],

  // In-App Purchase
  'asc-iap-missing-metadata': ['3.1.1'],
  'asc-iap-action-needed': ['3.1.1'],
  'asc-iap-rejected': ['3.1.1'],
  'asc-iap-no-localizations': ['3.1.1'],
  'asc-iap-missing-name': ['3.1.1'],
  'asc-iap-missing-description': ['3.1.1'],
  'asc-iap-missing-screenshot': ['3.1.1'],
  'asc-iap-screenshot-failed': ['3.1.1'],
  'asc-iaps-not-ready': ['3.1.1'],
  'asc-no-iaps': ['3.1.1'],

  // Launch screen
  'uiux-no-launch-screen': ['4.6'],
  'missing-launch-screen': ['4.6'],

  // App icons
  'uiux-no-app-icon': ['4.0'],
  'uiux-missing-appstore-icon': ['4.0'],
  'uiux-missing-iphone-icon': ['4.0'],
  'uiux-missing-ipad-icon': ['4.0'],
  'uiux-invalid-icon-contents': ['4.0'],

  // Privacy and data collection
  'missing-privacy-manifest': ['5.1.1'],
  'privacy-manifest-not-found': ['5.1.1'],
  'privacy-manifest-parse-error': ['5.1.1'],
  'tracking-no-domains': ['5.1.1'],
  'asc-missing-privacy-policy': ['5.1.1'],

  // iPad compatibility
  'uiux-ipad-missing-orientations': ['2.4.1'],

  // Accessibility
  'uiux-no-accessibility-labels': ['2.5.1'],
  'uiux-no-dynamic-type': ['2.5.1'],
};
