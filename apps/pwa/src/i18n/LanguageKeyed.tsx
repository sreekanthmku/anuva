import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Remounts the pages when the language changes, so text that came from the API follows too.
 *
 * Anything written with `t()` re-renders the instant the language changes. Anything the server
 * sent — Track questions and answer chips, the weekly report, the library, the home card — was
 * fetched in the old language (the request carried the old `Accept-Language`) and sat there,
 * half-translated, until the screen happened to fetch again on the next navigation.
 *
 * Every screen fetches its data on mount, so keying the routes on the language refetches all of
 * them at once, in the new language — including any added later, with nothing to remember. The
 * cost is that whatever was open on the page (a sheet, a half-typed field) resets, which is the
 * right trade for an action someone takes once, from the language menu.
 *
 * Sits inside the providers on purpose: they hold identity and session, not translated text, and
 * must not be torn down by a language switch.
 */
export function LanguageKeyed({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  return <Fragment key={i18n.language}>{children}</Fragment>;
}
