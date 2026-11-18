import { test, expect, loginIfNeeded } from './fixtures';

interface ToolSessionCreated {
  id: number;
  label: string;
  token: string;
  createdAt: string;
}

test.describe('tool sessions', () => {
  test('settings panel lists an active session and revoking it invalidates the token', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 15000 });

    const status = await page.evaluate(async () => {
      const res = await fetch('/api/auth/status');
      return res.json();
    });
    test.skip(!status.authRequired, 'authentication is disabled for this backend');

    const username = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;
    if (!username || !password) {
      throw new Error('E2E_USERNAME and E2E_PASSWORD are required when auth is enabled');
    }

    const label = `e2e-tool-session-${Date.now()}`;
    const session: ToolSessionCreated = await page.evaluate(
      async ({ username, password, label }) => {
        const res = await fetch('/api/auth/tool-sessions/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, label }),
        });
        if (!res.ok) {
          throw new Error(`tool session exchange failed: ${res.status}`);
        }
        return res.json();
      },
      { username, password, label }
    );

    // The freshly issued token authenticates a protected /api/* route.
    const bearerStatus = await page.evaluate(async ({ token }) => {
      const res = await fetch('/api/projects?open=true', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        credentials: 'omit',
      });
      return res.status;
    }, { token: session.token });
    expect(bearerStatus).toBe(200);

    await page.locator('button[title="Settings"]').click();
    const panel = page.locator('.settings-panel');
    await expect(panel).toBeVisible();

    const section = page.locator('#settings-tool-sessions');
    await expect(section).toBeVisible();

    const card = section.locator('.tool-session-card').filter({ hasText: label });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Created');

    await card.getByRole('button', { name: 'Revoke' }).click();
    await expect(card).toHaveCount(0);

    // Revocation is the only invalidation path: the token now fails.
    const revokedStatus = await page.evaluate(async ({ token }) => {
      const res = await fetch('/api/projects?open=true', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        credentials: 'omit',
      });
      return res.status;
    }, { token: session.token });
    expect(revokedStatus).toBe(401);
  });
});
