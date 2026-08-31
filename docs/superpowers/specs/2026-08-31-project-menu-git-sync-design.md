# Project Menu Git Sync

Add Fetch and Pull to the desktop and mobile project menus. Fetch runs `git
fetch --all`; Pull runs `git pull` and therefore respects repository and user
Git configuration.

Remote Git operations are tracked by project. Different projects may run in
parallel, while Fetch and Pull are mutually exclusive within one project. A
menu reopened during an operation shows `Fetching...` or `Pulling...` and
keeps both actions disabled. Offline mode disables both actions. Unsaved editor
content disables Pull but does not disable Fetch.

Pull refreshes the active project's file tree and reloads the current file. If
the current file was deleted, its view closes. If it becomes dirty while Pull
is running, the tree refreshes but the current file stays untouched and a
warning explains that it was not refreshed. Switching or closing projects
during an operation prevents the old operation from refreshing the new active
project.

An application-level toast reports completion for two seconds and errors or
warnings for five seconds. Messages include the project name. Git errors retain
their complete text in a height-limited, scrollable toast. A non-zero Git exit
status is an API error, including authentication failures, conflicts, missing
upstreams, and non-repository directories.

The desktop menu groups Refresh, remote Git actions, and project management
with separators. Its items use a 12px font and 5px 8px padding. The mobile menu
gets the same actions and grouping but retains its existing touch dimensions.
