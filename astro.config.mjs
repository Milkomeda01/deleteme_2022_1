// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.deniscartierarchitecte.fr',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
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
