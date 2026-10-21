/**
 * PLACEHOLDER TEXT — not legal advice and not the final documents.
 *
 * Stand-in Terms of Use and Privacy Policy so the sign-up consent flow can be built and tested.
 * Replace both with the versions approved by legal before launch, and bump
 * `TERMS_CONSENT_VERSION` in `@anuva/shared` when you do, so every new sign-up records the version
 * she actually read.
 *
 * Kept out of the i18n bundles on purpose: legal documents are translated and approved as whole
 * documents, not string by string.
 */

export type LegalSection = { heading: string; body: string[] };

export type LegalDocument = {
  title: string;
  updated: string;
  sections: LegalSection[];
};

export const TERMS_OF_USE: LegalDocument = {
  title: 'Terms of Use',
  updated: 'Draft · October 2026',
  sections: [
    {
      heading: '1. About Anuva Wellness',
      body: [
        'Anuva Wellness offers tools to track symptoms, learn about perimenopause and menopause, talk to Anu, our AI companion, and book consultations with Anuva Wellness professionals.',
        'By creating an account you agree to these terms. If you do not agree, please do not use the app.',
      ],
    },
    {
      heading: '2. Not a substitute for medical care',
      body: [
        'Anu and the content in the app are for general information and support. They are not a diagnosis or medical treatment, and do not replace advice from a qualified doctor.',
        'In an emergency, call your local emergency number or go to the nearest hospital.',
      ],
    },
    {
      heading: '3. Your account',
      body: [
        'You must be 18 or older to create an account. Keep your phone and login secure; you are responsible for activity on your account.',
        'Give accurate information so the app can support you properly.',
      ],
    },
    {
      heading: '4. Consultations',
      body: [
        'Consultations are provided by independent, qualified professionals through Anuva Wellness. Their advice is their own clinical judgement.',
        'Please join on time. Cancellation and rescheduling follow the rules shown when you book.',
      ],
    },
    {
      heading: '5. Acceptable use',
      body: [
        'Do not misuse the app, try to access other people’s data, or post anything unlawful or abusive in community or anonymous questions.',
      ],
    },
    {
      heading: '6. Changes and contact',
      body: [
        'We may update these terms. If the changes are significant, we will ask you to agree again.',
        'Questions? Write to us from Help in the app.',
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  updated: 'Draft · October 2026',
  sections: [
    {
      heading: '1. What we collect',
      body: [
        'Your name and phone number, the health information you choose to log (symptoms, periods, sleep, mood and more), your conversations with Anu, your notes, and your consultations.',
      ],
    },
    {
      heading: '2. How we use it',
      body: [
        'To run the app for you: show your trends, personalise Anu’s replies and suggestions, and support your consultations. We do not sell your data.',
      ],
    },
    {
      heading: '3. Who we share it with',
      body: [
        'Doctors see only what you choose to share with them for a consultation. Family members you invite see only what the app tells you they will see, and you can disconnect them at any time.',
        'Service providers that help us run the app (for example, hosting, SMS and AI providers) process data on our behalf. The full list is in Privacy in the app.',
      ],
    },
    {
      heading: '4. How long we keep it',
      body: [
        'We keep your data while your account is open. Consultation records are kept for the period medical rules require, even if you delete your account.',
      ],
    },
    {
      heading: '5. Your choices',
      body: [
        'You can download your data, delete parts of it, or delete your account from Privacy in the app.',
      ],
    },
    {
      heading: '6. Contact',
      body: ['Questions about your privacy? Write to us from Help in the app.'],
    },
  ],
};
