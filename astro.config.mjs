// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Deux cibles de build :
 *  - production   → https://www.deniscartierarchitecte.fr (Cloudflare Pages)
 *  - aperçu       → https://<user>.github.io/<repo>/ (GitHub Pages)
 * L'aperçu vit dans un sous-dossier et ne doit jamais être indexé : il ferait
 * doublon avec le vrai domaine aux yeux de Google.
 */
const preview = process.env.PREVIEW === '1';

export default defineConfig({
  site: preview
    ? process.env.PREVIEW_SITE || 'https://milkomeda01.github.io'
    : 'https://www.deniscartierarchitecte.fr',
  base: preview ? process.env.PREVIEW_BASE || '/deleteme_2022_1' : '/',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: preview
    ? []
    : [
        sitemap({
          changefreq: 'monthly',
          lastmod: new Date(),
          serialize(item) {
            if (item.url.endsWith('.fr/')) item.priority = 1.0;
            else if (/\/(maisons-d-architecte|centrale-photovoltaique|batiments-professionnels|contact)\//.test(item.url)) item.priority = 0.9;
            else if (/\/realisations\//.test(item.url)) item.priority = 0.7;
            else item.priority = 0.5;
            return item;
          },
        }),
      ],
  image: {
    // Photos are large scans/exports; cap work per image but keep quality high.
    responsiveStyles: true,
  },
});
