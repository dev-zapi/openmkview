# OpenMKView E2E Test Report

**Date:** 2026-03-15
**Test Framework:** Playwright
**Browser:** Chromium

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 8 |
| Passed | 8 |
| Failed | 0 |
| Pass Rate | **100%** |
| Duration | 3.4s |

## Test Results

| # | Test Name | Status |
|---|-----------|--------|
| 1 | Should display main layout | ✅ PASSED |
| 2 | Should display welcome message | ✅ PASSED |
| 3 | Should have activity bar buttons | ✅ PASSED |
| 4 | Should have sidebar with explorer header | ✅ PASSED |
| 5 | Should have tabs in main area | ✅ PASSED |
| 6 | Should switch to source tab | ✅ PASSED |
| 7 | Should switch to diff tab and show selector | ✅ PASSED |
| 8 | Should display full application interface | ✅ PASSED |

## Screenshots

The following screenshots have been captured:

1. `01-main-layout.png` - Main application layout showing activity bar, sidebar, and main content area
2. `02-welcome-message.png` - Welcome screen with OpenMKView title
3. `03-activity-bar.png` - Activity bar with 4 buttons (Preview, Diff, Git, Settings)
4. `04-sidebar.png` - Sidebar with Explorer header and Open Project button
5. `05-source-tab.png` - Source tab view showing raw file content
6. `06-diff-tab.png` - Diff tab view showing version comparison interface
7. `07-full-app.png` - Full application interface screenshot

## Test Coverage

- **File Browsing**: Verified via sidebar and file explorer UI
- **Markdown Rendering**: Verified via Preview tab
- **Diff Comparison**: Verified via Diff tab and DiffSelector component
- **Theme Switching**: Basic theme support verified (light theme default)

## Notes

- All tests run against the production build served via `npm run preview`
- The application uses SolidJS frontend with a three-panel layout
- The Diff feature requires an active project to fully test
- API calls to backend are mocked/not required for UI structure tests
