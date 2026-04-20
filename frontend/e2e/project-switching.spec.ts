import { test, expect, loginIfNeeded, waitForDesktopApp } from './fixtures';

test.describe('Project Switching Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginIfNeeded(page);
    await waitForDesktopApp(page);
  });

  test('keeps project buttons stable when switching projects', async ({ page }) => {
    const readProjectButtons = async () => {
      return page.locator('.activity-bar-projects button[title]').evaluateAll((elements) =>
        elements.map((element) => ({
          title: element.getAttribute('title'),
          className: element.className,
          style: element.getAttribute('style') ?? '',
        }))
      );
    };

    const expectSingleActive = (buttons: Array<{ title: string | null; className: string }>, title: string) => {
      expect(buttons.filter((button) => button.className.includes('active'))).toHaveLength(1);
      expect(buttons.filter((button) => button.title === title)).toHaveLength(1);
      expect(buttons.find((button) => button.title === title)?.className).toContain('active');
    };

    for (const title of ['openmkview', 'workspace']) {
      await expect(page.getByTitle(title, { exact: true })).toBeVisible();
    }

    const initialButtons = await readProjectButtons();
    expect(initialButtons.map((button) => button.title)).toContain('openmkview');
    expect(initialButtons.map((button) => button.title)).toContain('workspace');

    await page.getByTitle('openmkview', { exact: true }).click();
    await expect(page).toHaveURL(/\/project\/6$/);
    await expect(page.locator('.sidebar-header-name')).toHaveText('openmkview');

    const afterOpenMkView = await readProjectButtons();
    expect(afterOpenMkView.filter((button) => button.title === 'workspace')).toHaveLength(1);
    expectSingleActive(afterOpenMkView, 'openmkview');
    expect(afterOpenMkView.find((button) => button.title === 'workspace')?.className).toContain('project-color-hint');
    expect(afterOpenMkView.find((button) => button.title === 'workspace')?.style).toContain('--project-color');

    await page.getByTitle('workspace', { exact: true }).click();
    await expect(page).toHaveURL(/\/project\/3$/);
    await expect(page.locator('.sidebar-header-name')).toHaveText('workspace');

    const afterWorkspace = await readProjectButtons();
    expect(afterWorkspace.filter((button) => button.title === 'openmkview')).toHaveLength(1);
    expectSingleActive(afterWorkspace, 'workspace');
    expect(afterWorkspace.find((button) => button.title === 'openmkview')?.className).toContain('project-color-hint');
    expect(afterWorkspace.find((button) => button.title === 'openmkview')?.style).toContain('--project-color');
  });
});
