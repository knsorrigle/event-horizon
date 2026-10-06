import { useEffect } from 'react';

/**
 * Keep <title> and the description in step with client-side route changes.
 * (Crawlers get per-page HTML from scripts/postbuild.mjs; this is for tabs,
 * history and anything that reads the live document.)
 */
export function useDocumentMeta(title: string, description: string): void {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}
