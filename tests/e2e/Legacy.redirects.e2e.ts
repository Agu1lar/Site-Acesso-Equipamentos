import { expect, test } from '@playwright/test';

test.describe('WordPress legacy 301 redirects', () => {
  test('redirects blog index to dicas', async ({ request }) => {
    const response = await request.get('/blog/', { maxRedirects: 0 });

    expect(response.status()).toBe(301);
    expect(response.headers().location).toMatch(/\/dicas$/u);
  });

  test('redirects aerial blog post to dicas article', async ({ request }) => {
    const response = await request.get(
      '/plataforma-elevatoria-tesoura-a-solucao-ideal-para-trabalhos-em-altura/',
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(301);
    expect(response.headers().location).toMatch(
      /\/dicas\/como-escolher-plataforma-elevatoria-bh$/u,
    );
  });

  test('redirects wp category archive to equipamentos', async ({ request }) => {
    const response = await request.get('/category/plataformas-elevatorias/', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(301);
    expect(response.headers().location).toMatch(/\/equipamentos$/u);
  });

  test('redirects wp sitemap index to sitemap.xml', async ({ request }) => {
    const response = await request.get('/wp-sitemap.xml', { maxRedirects: 0 });

    expect(response.status()).toBe(301);
    expect(response.headers().location).toMatch(/\/sitemap\.xml$/u);
  });

  test('redirects wp pagination to dicas', async ({ request }) => {
    const response = await request.get('/page/2', { maxRedirects: 0 });

    expect(response.status()).toBe(301);
    expect(response.headers().location).toMatch(/\/dicas$/u);
  });

  test('leaves marketing routes unchanged', async ({ request }) => {
    const response = await request.get('/orcamento', { maxRedirects: 0 });

    expect(response.status()).toBe(200);
  });
});
