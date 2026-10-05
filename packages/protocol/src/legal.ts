/** Admin-editable legal documents served at /privacy and /terms. */
export type LegalDocKey = 'privacy' | 'terms';

export interface LegalDoc {
  title: string;
  /** ISO date `YYYY-MM-DD`. */
  lastUpdated: string;
  /**
   * Markdown subset: `##` / `###` headings, paragraphs, `- ` bullets, `**bold**`,
   * `[text](url)` links. Tokens like `{{contactEmail}}` are filled in at render time.
   */
  body: string;
}

export type LegalDocs = Record<LegalDocKey, LegalDoc>;

export const LEGAL_DOC_KEYS: readonly LegalDocKey[] = ['privacy', 'terms'] as const;

export const LEGAL_DOC_PATHS: Record<LegalDocKey, string> = {
  privacy: '/privacy',
  terms: '/terms',
};

export const MAX_LEGAL_TITLE_CHARS = 120;
export const MAX_LEGAL_BODY_CHARS = 50_000;

export const LEGAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const LEGAL_TOKENS = [
  'siteName',
  'operatorName',
  'contactEmail',
  'jurisdiction',
  'minAge',
] as const;

export type LegalToken = (typeof LEGAL_TOKENS)[number];

const PRIVACY_BODY = `This Privacy Policy explains what information {{siteName}} ("we", "us") collects when you use the site and apps, how we use it, and the choices you have. {{siteName}} is operated by {{operatorName}}.

## Information we collect

### Information you give us

- **Account details:** your username, password (stored only as a salted hash), avatar choice, and, if you provide it, your email address.
- **Social sign-in:** if you sign in with Google or Instagram, we receive your account identifier and the basic profile details that provider shares (such as name and email). We never receive your provider password.
- **Content you post:** table chat messages, contest and table names, friend groups, and messages you send to our chat bots.

### Information created when you play

- Game activity such as hands played, hand history, results, contest entries, and your play-money chip and Whuffie balances.
- Social data such as friends, friend requests, groups, invitations, and online presence.
- Preferences such as theme, card style, table layout, sound, and keyboard shortcuts.

### Technical information

- Our servers keep standard logs (IP address, browser type, request time, and errors) to run, secure, and debug the service.
- Your browser's local storage keeps your session and preferences so you stay signed in. We do not use advertising cookies, and we do not run third-party analytics or ad trackers.

### Voice chat

Table voice chat uses peer-to-peer WebRTC. Our server only relays the connection setup between players; audio goes directly between participants and is never recorded or stored by us. Connection setup uses a public STUN server (Google) that sees your IP address.

## How we use information

- To create and secure your account and keep you signed in.
- To run tables, contests, friends, chat, and game history.
- To send account emails you ask for, such as email verification, a welcome note, and password resets.
- To prevent cheating, abuse, and fraud, and to enforce our [Terms & Conditions](/terms).
- To keep the service working and improve it.

We do not sell your personal information, and we do not use it for targeted advertising.

## Chat bots and AI providers

Messages you send to our chat bots, and some table context used for bot banter, are sent to third-party AI providers (such as Cohere) to generate replies. Do not share sensitive personal information with the bots. Bot replies are generated automatically and may be inaccurate.

## Who we share information with

- **Other players** see your username, avatar, table activity, chat messages, and online status.
- **Service providers** that host our servers and database, deliver email, provide social sign-in, and generate bot replies. They may only use the information to provide their services to us.
- **Legal reasons:** when required by law or to protect the rights, safety, and security of our users and the service.

## How long we keep information

We keep account information for as long as your account exists. Game history and logs may be kept for a limited period for fairness, security, and debugging. When you delete your account, we delete or anonymise your personal information unless we must keep it for legal reasons.

## Your choices and rights

- You can update your avatar, preferences, and email from your profile.
- You can ask us for a copy of your data, to correct it, or to delete your account by emailing [{{contactEmail}}](mailto:{{contactEmail}}).
- Depending on where you live, you may have additional rights under local data protection law. Contact us and we will respond within a reasonable time.

## Age requirement

{{siteName}} is intended only for people aged {{minAge}} or older. We do not knowingly collect information from anyone under {{minAge}}. If you believe someone under {{minAge}} has created an account, contact us and we will remove it.

## Security

We use reasonable technical and organisational measures to protect your information, including hashed passwords and encrypted connections. No online service can be completely secure, so please use a unique password.

## International transfers

Our servers and service providers may be located in countries other than yours. By using {{siteName}}, you understand that your information may be processed in those countries.

## Changes to this policy

We may update this policy from time to time. When we do, we will change the "Last updated" date above, and for significant changes we will let you know on the site.

## Contact

Questions about privacy? Email [{{contactEmail}}](mailto:{{contactEmail}}).`;

const TERMS_BODY = `These Terms & Conditions ("Terms") govern your use of {{siteName}}, operated by {{operatorName}} ("we", "us"). By creating an account or using the site, you agree to these Terms and to our [Privacy Policy](/privacy). If you do not agree, do not use {{siteName}}.

## Eligibility

You must be at least {{minAge}} years old to use {{siteName}}. By using the site, you confirm that you meet this requirement and that using a poker-themed game is legal where you live.

## Play money only

- {{siteName}} is a free social game. Chips, Whuffies, and any other in-game balances are **play money with no real-world value**.
- They cannot be bought, sold, cashed out, exchanged for money or prizes, or transferred outside the game.
- {{siteName}} does not offer real-money gambling. Success in a social game does not mean future success at real-money gambling.
- We may adjust, reset, or remove in-game balances at any time, for example to fix errors or address abuse.

## Your account

- You are responsible for your account and for keeping your password secret.
- Usernames must not impersonate others or be offensive, hateful, or misleading.
- One person, one account. Do not share, sell, or transfer accounts.
- Tell us right away at [{{contactEmail}}](mailto:{{contactEmail}}) if you think someone else has accessed your account.

## Fair play and acceptable use

You agree not to:

- Cheat, collude, chip-dump, or share hole cards with other players.
- Use bots, scripts, solvers, or other automation to play for you, unless the feature is provided by {{siteName}}.
- Exploit bugs, interfere with the service, or try to access accounts or data that are not yours.
- Harass, threaten, or abuse other players, or post hateful, sexual, illegal, or spam content in chat, names, or voice.
- Use {{siteName}} for any unlawful purpose.

We may remove content, reset balances, or suspend or close accounts that break these rules.

## Your content

You keep ownership of the messages and other content you post. You give us a worldwide, non-exclusive, royalty-free licence to host, display, and process that content only to operate and improve {{siteName}}. You are responsible for what you post.

## Chat bots

Bot players and chat bots are automated and some replies are generated by third-party AI services. Bot replies are for entertainment only, may be inaccurate or inappropriate, and are not advice. Do not rely on them and do not share sensitive information with them.

## Voice and chat with other players

Voice and chat connect you with other players we do not control. Use the mute and friend controls if someone behaves badly, and report abuse to [{{contactEmail}}](mailto:{{contactEmail}}).

## Our intellectual property

The {{siteName}} name, logo, artwork, sounds, and software belong to us or our licensors. You may use them only to play the game as offered. Do not copy, modify, or reverse-engineer the service.

## Ending your use

You can stop using {{siteName}} at any time and ask us to delete your account. We may suspend or end your access at any time if you break these Terms or if we need to protect the service or other players. We may also change or discontinue features, or the service as a whole.

## Disclaimers

{{siteName}} is provided "as is" and "as available", without warranties of any kind. We do not guarantee that the service will be uninterrupted, error-free, or that game results, balances, or history will be preserved.

## Limitation of liability

To the fullest extent allowed by law, we are not liable for any indirect, incidental, special, or consequential damages, or for any loss of data, play money, or goodwill, arising from your use of {{siteName}}. Because the service is free, our total liability for any claim is limited to the greatest extent permitted by law.

## Governing law

These Terms are governed by the laws of {{jurisdiction}}, and any disputes will be handled by the courts of {{jurisdiction}}, unless the law where you live requires otherwise.

## Changes to these Terms

We may update these Terms from time to time. When we do, we will change the "Last updated" date above. If you keep using {{siteName}} after changes take effect, you accept the updated Terms.

## Contact

Questions about these Terms? Email [{{contactEmail}}](mailto:{{contactEmail}}).`;

export const DEFAULT_LEGAL_DOCS: LegalDocs = {
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: '2026-10-04',
    body: PRIVACY_BODY,
  },
  terms: {
    title: 'Terms & Conditions',
    lastUpdated: '2026-10-04',
    body: TERMS_BODY,
  },
};

export function cloneLegalDocs(docs: LegalDocs): LegalDocs {
  return {
    privacy: { ...docs.privacy },
    terms: { ...docs.terms },
  };
}

function normalizeLegalDoc(raw: unknown, fallback: LegalDoc): LegalDoc {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback };
  const o = raw as Record<string, unknown>;
  const title =
    typeof o.title === 'string' && o.title.trim()
      ? o.title.trim().slice(0, MAX_LEGAL_TITLE_CHARS)
      : fallback.title;
  const lastUpdated =
    typeof o.lastUpdated === 'string' && LEGAL_DATE_RE.test(o.lastUpdated.trim())
      ? o.lastUpdated.trim()
      : fallback.lastUpdated;
  const body =
    typeof o.body === 'string' && o.body.trim()
      ? o.body.replace(/\r\n/g, '\n').trim().slice(0, MAX_LEGAL_BODY_CHARS)
      : fallback.body;
  return { title, lastUpdated, body };
}

/** Missing or invalid fields fall back to {@link DEFAULT_LEGAL_DOCS}. */
export function normalizeLegalDocs(raw: unknown): LegalDocs {
  const o =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    privacy: normalizeLegalDoc(o.privacy, DEFAULT_LEGAL_DOCS.privacy),
    terms: normalizeLegalDoc(o.terms, DEFAULT_LEGAL_DOCS.terms),
  };
}
