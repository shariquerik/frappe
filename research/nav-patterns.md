# How other products let a person arrange a rail and sidebar

Research for [#47373](https://github.com/frappe/frappe/issues/47373), a child of the map
[Desk v2 — arranging the rail and the sidebar](https://github.com/frappe/frappe/issues/47369).

This file has facts and the patterns that recur. It does not recommend anything for desk v2.

**Sources.** Product claims come from vendor docs, help centres and changelogs, read on
2026-11-14. Each claim links its source. "Unconfirmed" means no primary source said it. It
does not mean the feature is missing. Frappe app claims come from the source on this bench:

- Gameplan `c643ae8` (v0.1.14, `develop`);
- CRM `1310072d9` (`desk-v2` branch);
- Helpdesk `34bfd4e` (`develop`).

Nothing was run in a browser.

## At a glance

| Product | Rail + sidebar? | Add rows from | Who can set it | Nesting | Auto-hide / peek | Right side? | Search / notifications |
|---|---|---|---|---|---|---|---|
| Linear | Sidebar only | Star on the page; "Customize sidebar" | Just me | Favorites folders | Collapse, peek on hover | No | Inbox is a sidebar row |
| Notion | Sidebar (with tabs) | "Add shortcut", "Add view to sidebar", customize mode | Me, plus admin presets | Pages without limit | Collapse, peek on hover | No | Search top of sidebar, inbox top-right |
| Slack | Rail + sidebar | Drag or "Move" into sections | Me, plus shared sections | Sections, 1 level | Icons only | No | Search top bar, Activity a rail tab |
| Attio | Sidebar only | Star on the page | Just me | Favorites folders | Collapse | No | Both are sidebar rows at the top |
| ClickUp | Rail + sidebar | Pin, star, "Customize navigation" | Just me | Sections; Space > Folder > Subfolder > List | Collapse, hover a rail icon to preview | No | Search top bar, Inbox top of sidebar |
| Jira Cloud | Sidebar + top bar | Star; "Customize sidebar" | Me; space admins for space tabs | Spaces expand 1 level | Collapse, resize | No | Both in the top bar |
| GitHub | Slide-out panel | Saved views in a dashboard sidebar | Me; triage+ for shared repo views | Flat | Panel, collapsible repo sidebar | No | Both in the top bar |
| VS Code | Rail + sidebar | Drag views; right-click to hide | Just me | Container > views | Toggle; Zen mode | **Yes** | Search a side bar view, bell in status bar |
| Teams | Rail + list | Pin apps; custom sections | Me, plus admin policy pins | Sections, 1 level | Unconfirmed | No | Search top bar, Activity a rail item |
| Gameplan | Rail + sidebar (sidebar only on community pages) | Pin a space; dialog shows/hides communities | Just me | Flat | No | No | Both rail rows under the logo |
| CRM | Sidebar only | "Pin View", "Make Public" on a view | Me; managers for everyone | Flat sections | Collapse to icons | No | Both sidebar rows at the top |
| Helpdesk | Sidebar only | "Pin View", "Make Public" on a view | Me; managers for everyone | Flat sections | Collapse to icons | No | Both sidebar rows at the top |

## Linear

1. **Adding rows.**
   - A person stars an item to add it to Favorites. The star is in the page header, or press
     `Alt+F`, or use the command menu. A person can favorite issues, projects, views (custom,
     label and default views), documents, initiatives, cycles, labels, teams, customers,
     dashboards, pull requests and releases. Favorites sit "above Your Teams". Remove one with
     the hover ×. ([Favorites](https://linear.app/docs/favorites);
     [image](https://webassets.linear.app/images/ornj730p/production/21619d150ec1a00878e780cf206c6dc1dc875844-1564x1018.png))
   - Built-in rows can be reordered by drag, hidden, or moved into a **More** menu. Unread
     notifications show as a **count or a dot**. Right-click an item or use "Customize
     sidebar". The changelog calls it customization "to fit your personal workflows"
     ([Personalized sidebar, 2024-12-18](https://linear.app/changelog/2024-12-18-personalized-sidebar)).
   - On mobile, a person can rearrange the main nav and pin projects, initiatives and documents
     ([changelog 2026-01-22](https://linear.app/changelog/2026-01-22-customize-your-navigation-in-linear-mobile)).
   - URL rows, action rows, renaming rows and a workspace default: unconfirmed.
2. **Sections and nesting.** A person can make named Favorites folders and drag favorites in and
   out ([Favorites](https://linear.app/docs/favorites)). Folders inside folders: unconfirmed.
3. **Rail or sidebar.** One sidebar.
   - Collapse it with `[`, a click on its border, or the command menu
     ([changelog](https://linear.app/changelog/unpublished-collapsible-sidebar)).
   - A collapsed sidebar opens on hover. The
     [2026-03-12 UI refresh](https://linear.app/changelog/2026-03-12-ui-refresh) fixed a case
     where it "would sometimes not open on hover".
   - Both sidebars resize by drag
     ([changelog 2020-04-27](https://linear.app/changelog/2020-04-27-improved-my-issues-view)).
4. **Placement.** The Inbox is "in the sidebar" ([Inbox](https://linear.app/docs/inbox)). Where
   search sits and a left/right option: unconfirmed.

## Notion

1. **Adding rows.**
   - The sidebar has **tabs**: up to 6 tabs, each with up to 25 shortcuts, 25 sections and 3
     pinned database views.
   - A person can add built-in shortcuts (New page, New chat, My Tasks, Library and others),
     built-in sections (Recents, Favorites, Teamspaces, Shared, Private and others), page
     shortcuts ("Add shortcut"), and database views ("Add view to sidebar", which keeps the
     filters and sorts). "New page" and "New chat" are **action rows**.
   - Right-click the sidebar to enter customize mode. There a person turns items on or off,
     drags to reorder, adds or deletes tabs, and resets a tab. "Your sidebar setup is yours
     alone" ([Customize your sidebar](https://www.notion.com/en-gb/help/customize-your-sidebar)).
   - The Inbox (top-right) and the workspace switcher (bottom) cannot move (same page).
   - The tabbed sidebar shipped as opt-in on 2026-03-26
     ([release](https://www.notion.com/releases/2026-03-26);
     [GIF](https://images.ctfassets.net/spoqsaf9291f/6R8KIHTn55Om9GLLDHb5Id/2d8faff81a9759c0437e47aceffe3807/Sidebar_FINAL.gif)).
   - **Admin presets.** Workspace admins set presets. "Default presets" are added for every
     member automatically, including new members. "Optional presets" are added by a member
     from "Add tab". "Every workspace needs at least one default preset." A member can
     "change or remove a tab that came from a preset" and "reset a changed tab back to its
     preset". "Presets give members a starting point. Members stay in control of their own
     sidebar." ([Manage sidebar presets](https://www.notion.com/help/manage-sidebar-presets-for-your-workspace))
   - External links as rows: unconfirmed.
2. **Sections and nesting.** Pages nest "on infinite levels". Sections collapse when a person
   clicks the name. The `•••` menu sets how many items a section shows, and moves or hides the
   section. A teamspace owner can turn off sidebar editing for that teamspace.
   ([Navigate with the sidebar](https://www.notion.com/help/navigate-with-the-sidebar);
   [image](https://images.ctfassets.net/spoqsaf9291f/2tpJheiXLOwBH9ZdZGnQt3/514bd06e33972f166580fa5c50bcdbdf/Group_61.png))
3. **Rail or sidebar.** One sidebar with tabs at its top. Collapse it with `<<` or
   `Cmd/Ctrl+\`, and resize it by dragging the edge
   ([Navigate with the sidebar](https://www.notion.com/help/navigate-with-the-sidebar)). When it
   is collapsed, "hover over the top left of the screen" to open it, and "click the arrows to
   lock the sidebar open"
   ([team sidebar guide](https://www.notion.com/help/guides/the-best-way-to-set-up-your-teams-sidebar-for-clear-organization)).
4. **Placement.** Search is the top item. The Inbox is top-right. The switcher and settings are
   at the bottom. None of them moves. Left/right option: unconfirmed.

## Slack

1. **Adding rows.**
   - Rows are conversations (channels, DMs, apps). A person moves them into sections by drag,
     "Move", or "Bulk manage conversations". Custom sections need a paid plan and "are only
     visible to you"
     ([Custom sections](https://slack.com/help/articles/360043207674-Organize-your-sidebar-with-custom-sections)).
   - Preferences → Navigation: tick which rail tabs (Home, Activity, To-dos and others) stay in
     the bar. Unticked tabs move under **More**. Reorder by drag or arrows. Preferences → Home
     sets what shows at the top of Home and its sort order. "Active only" hides conversations
     with no activity for 30 days
     ([Sidebar preferences](https://slack.com/help/articles/212596808-Adjust-your-sidebar-preferences)).
   - **Shared sections.** A person can share a section by DM. A user-group manager can turn on
     "Add group channels as a section in Home", one section for each group. Receivers can
     change the shared section
     ([Share sidebar sections](https://slack.com/help/articles/29873996048019-Share-sidebar-sections-in-Slack)).
     No admin-pushed fixed layout is documented.
   - Arbitrary links or views as rows: unconfirmed.
2. **Sections and nesting.** Custom sections can be created, renamed, given an emoji and
   deleted. Each one sorts A–Z, by recency or by priority
   ([Custom sections](https://slack.com/help/articles/360043207674-Organize-your-sidebar-with-custom-sections);
   [GIF](https://slack.zendesk.com/hc/article_attachments/42722969969299)). Sections reorder and
   collapse ([2020 blog](https://slack.com/blog/productivity/simpler-more-organized-slack)).
   Nested sections are not documented.
3. **Rail plus sidebar.** The 2023 redesign added a rail with Home, DMs, Activity, Later and
   More. Each rail tab gives the sidebar a different view
   ([2023 blog](https://slack.com/blog/productivity/a-redesigned-slack-built-for-focus);
   [GIF](https://d34u8crftukxnk.cloudfront.net/slackpress/prod/sites/6/Dedicated-views.gif);
   [diagram](https://slack.zendesk.com/hc/article_attachments/37498666689811)). The sidebar
   resizes by drag and has "show icons only". "Simplified layout mode", an accessibility
   setting, replaces the sidebar with a landing page and one nav bar at the top
   ([Simplified layout](https://slack.com/help/articles/41214514885907-Use-simplified-layout-mode-in-Slack)).
   Hover peek: unconfirmed.
4. **Placement.** Search, create (+) and profile are in the top bar. Activity (notifications) is
   a rail tab
   ([Quick start](https://slack.com/help/articles/360059928654-How-to-use-Slack--your-quick-start-guide);
   [diagram](https://slack.zendesk.com/hc/article_attachments/35077810682003)). Tabs can be
   reordered or hidden. A right-side option: none found.

## Attio

1. **Adding rows.** A person stars an item: a record, a list view, an all-records view, a
   dashboard, a workflow, a sequence, a note or template (⋮ → "Add to favorites"), or an Ask
   Attio chat. Starred items go to Favorites, which a person reorders by drag. Favorites "won't
   appear in other team members' sidebars". The Lists section sorts by most relevant, recently
   added, alphabetical or custom. It shows six lists unless "Show all lists" is on. The sort
   choice is personal, but the Custom order is shared by everyone who picks Custom. Built-in
   rows (Home, Search, Inbox, Tasks, Notes and others) cannot be hidden. Admins can deactivate
   standard objects, which removes them
   ([Navigating your workspace](https://attio.com/help/reference/productivity-collaborating/navigating-your-workspace);
   [Manage standard objects](https://attio.com/help/reference/managing-your-data/objects/manage-standard-objects)).
   URL or action rows: unconfirmed.
2. **Sections and nesting.** Fixed sections, plus personal folders inside Favorites. Create one
   from the folder icon on the Favorites header. Deleting a folder also unfavorites what is in
   it. Folders inside folders: unconfirmed.
3. **Rail or sidebar.** One sidebar. It "is expandable and collapsible"
   ([Introduction to navigating Attio](https://attio.com/help/reference/attio-101/introduction-to-navigating-attio)).
   Peek or resize: unconfirmed.
4. **Placement.** Search is at the top of the sidebar (also `/` and `Cmd+K`). The Inbox is a
   row in the top group. Neither moves.
   [Screenshot](https://a.storyblok.com/f/234930/626x921/27b93190df/attio-sidebar.png).

## ClickUp

1. **Adding rows.** Three places, all personal ("Every user can customize their own Global
   Navigation"):
   - **Rail (Global Navigation).** Pin an icon from More, or tick it in More → "Customize
     navigation". Unpin by right-click. Home and More cannot be unpinned.
   - **Home Sidebar.** Pin pages from Customize → Home. Inbox and Replies cannot be unpinned.
   - **Favorites.** Star Spaces, Folders, Lists, tasks, Channels, DMs, Docs, Dashboards, Views
     and more. "Pin to top" or "Pin to bottom". A favorited view can get a **personal alias**.

   Spaces can be hidden and reordered for each person. URL rows and an admin default:
   unconfirmed.
   ([What is Global Navigation?](https://help.clickup.com/hc/en-us/articles/32050886697495-What-is-Global-Navigation);
   [Customize your ClickUp experience](https://help.clickup.com/hc/en-us/articles/35709363436823-Customize-your-ClickUp-experience);
   [Favorites](https://help.clickup.com/hc/en-us/articles/6308862167575-Favorites);
   [Move, hide, or reorder Spaces](https://help.clickup.com/hc/en-us/articles/6309404591895-Move-hide-or-reorder-Spaces))
2. **Sections and nesting.**
   - Custom Home Sidebar sections have a name and an emoji, up to 100. An item can be in more
     than one section
     ([Create custom sections](https://help.clickup.com/hc/en-us/articles/32855333466903-Create-custom-Home-Sidebar-sections)).
   - Default sections (Favorites, Channels, DMs, Spaces, Recents and others) "cannot be hidden"
     but reorder by drag, and each has a limit and a sort setting
     ([Default sections](https://help.clickup.com/hc/en-us/articles/32854720651543-Default-Home-Sidebar-sections-and-settings)).
   - The data hierarchy is Space > Folder > Subfolder (one level only) > List > task
     ([Subfolders](https://help.clickup.com/hc/en-us/articles/36811534175383-What-are-Subfolders)).
3. **Rail plus sidebar.** Global Navigation is "the vertical bar on the left", shown as "Icons &
   Labels" or "Icons only". Beside it is a sidebar for the context (Home, Spaces, Hubs). The
   sidebar collapses, and the expand icon at the top of the rail opens it again. Drag the
   divider to resize, and double-click to reset the width. "When a feature is pinned, you can
   hover over it to see a preview of its sidebar."
   ([What is the Home Sidebar?](https://help.clickup.com/hc/en-us/articles/32057009861271-What-is-the-Home-Sidebar);
   [image](https://help.clickup.com/hc/article_attachments/36795136346775))
4. **Placement.** Search (AI Command Bar) is in the middle of the top toolbar, and the avatar is
   at its right. A person can pin tools to the toolbar. The Inbox is at the top of the Home
   Sidebar. Invite is at the bottom of the rail
   ([Intro to the toolbar](https://help.clickup.com/hc/en-us/articles/11583054545303-Intro-to-the-toolbar);
   [Customize the toolbar](https://help.clickup.com/hc/en-us/articles/8746698620567-Customize-the-toolbar)).
   Right side: unconfirmed.

## Jira Cloud (new navigation)

1. **Adding rows.**
   - More → "Customize sidebar" shows, hides and reorders items with checkboxes and drag.
     Starring a filter or dashboard adds it to Starred. Customization "is personal to your
     account"
     ([What is the new navigation in Jira?](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-new-navigation-in-jira/);
     [image](https://images.ctfassets.net/zsv3d0ugroxu/2IFK7G08V77Po98JrY7ojl/0cafb2e08e00c4a26724d7363bd723d6/Jira_feature_-_Customise_sidebar.png)).
   - Space and board admins rename, remove, re-add and reorder a space's horizontal tabs for
     everyone
     ([Manage the space navigation](https://support.atlassian.com/jira-software-cloud/docs/manage-and-customize-the-project-navigation/)).
   - Space admins can add **shortcuts (a URL plus a name)** that everyone in the space sees
     ([Add a shortcut](https://support.atlassian.com/jira-software-cloud/docs/add-edit-or-delete-a-shortcut/)).
     This page may be older than the new navigation.
   - In Jira Service Management, "only admins can hide or show sidebar items, but changes are
     visible for everyone in the space"
     ([New navigation in JSM](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-new-navigation-in-jira-service-management/)).
2. **Sections and nesting.** Fixed rows: For you, Recent, Starred, Apps, Spaces, Dashboards and
   more. Spaces "expand to navigate within them", one level. Custom sections: none documented.
3. **Rail or sidebar.** One sidebar plus a top bar. Resize it, or collapse it with "Hide
   sidebar" or `Ctrl+[`
   ([Navigation best practices](https://support.atlassian.com/navigation/docs/navigation-best-practices/)).
   Hover peek on Cloud: unconfirmed.
4. **Placement.** The top bar holds the app switcher, search, Create, and "utility items like
   Notifications, Settings, and Account". None of them moves.
   [Overview image](https://images.ctfassets.net/zsv3d0ugroxu/2umofziJhIf3zcHVQjDbTi/86232e7d8050e298ebb500291871a518/Jira_-_feature_overview_-_Jira_only.png).

## GitHub (web)

1. **Adding rows.**
   - On the Issues dashboard, a person saves views (title, description, icon, query) in the
     left sidebar under "Views", up to 25
     ([Viewing all issues and PRs](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/viewing-all-of-your-issues-and-pull-requests#create-a-saved-view)).
     The repository dashboard works the same way
     ([changelog 2026-02-24](https://github.blog/changelog/2026-02-24-repository-dashboard-is-now-generally-available/)).
   - Repository Issues has shared saved views (triage access or above)
     ([changelog 2026-06-25](https://github.blog/changelog/2026-06-25-saved-views-for-repository-issues-and-adjustable-row-heights-in-projects/))
     and personal ones
     ([changelog 2026-09-25](https://github.blog/changelog/2026-09-25-personal-saved-views-for-repository-issues-and-more/)).
     Views, projects and milestones can be pinned to the repository sidebar
     ([changelog 2026-08-20](https://github.blog/changelog/2026-08-20-pin-projects-views-and-milestones-to-the-repository-sidebar/)).
     Who can pin: unconfirmed.
   - The global menu lists top repositories and teams, and has no documented customization
     ([changelog 2023-10-17](https://github.blog/changelog/2023-10-17-redesigned-navigation-now-available-to-all-users/)).
2. **Sections and nesting.** Flat lists under fixed headings.
3. **Rail or sidebar.** The global menu is a slide-out panel from the top-left icon. The
   repository Issues sidebar collapses, and pinned views stay reachable then.
4. **Placement.** Search, command palette and the inbox are in the top bar
   ([Managing notifications](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox)).
   Nothing moves. [Global nav image](https://github.com/primer/design/assets/3369400/3a319003-b6a5-47d0-ad35-01015f61a74e).

## VS Code

1. **Adding rows.** Right-click the Activity Bar to show or hide icons, and drag to reorder
   ([User Interface](https://code.visualstudio.com/docs/getstarted/userinterface#_basic-layout)).
   Drag a view between the Primary Side Bar, the Secondary Side Bar and the Panel. Drop one view
   on another to group them. "Reset Location" and "View: Reset View Locations" undo it
   ([Custom Layout](https://code.visualstudio.com/docs/configure/custom-layout#_workbench);
   [GIF](https://code.visualstudio.com/assets/docs/configure/custom-layout/drag-and-drop-views.gif)).
   All settings are for one user. No URL rows and no renaming.
2. **Sections and nesting.** Two levels: a container (an Activity Bar icon) holds stacked views.
3. **Rail plus sidebar.**
   - `workbench.activityBar.location` is Default (side), Top, Bottom or Hidden. **Hidden leaves
     the side bar only.** Top came in [v1.84](https://code.visualstudio.com/updates/v1_84),
     Bottom in [v1.88](https://code.visualstudio.com/updates/v1_88)
     ([image](https://code.visualstudio.com/assets/updates/1_88/activity-bar-positions.png)).
   - `Ctrl/Cmd+B` toggles the side bar. Zen Mode hides everything but the editor.
   - Auto-hide: none.
4. **Placement.**
   - **`workbench.sideBar.location: right`** (or "Move Primary Side Bar Right") puts the side
     bar on the right. The Secondary Side Bar always sits on the other side
     ([Custom Layout](https://code.visualstudio.com/docs/configure/custom-layout#_workbench);
     [image](https://code.visualstudio.com/assets/docs/configure/custom-layout/primary-side-bar.png)).
   - Accounts and Manage sit at the bottom of a side Activity Bar. When the bar is at the top
     or bottom, they move to the right of the title bar.
   - The notifications bell is in the Status Bar. Toasts show bottom-right.
     `workbench.notifications.position` (experimental) allows bottom-left or top-right.
   - Search is a side bar view.

## Microsoft Teams

1. **Adding rows.**
   - A person pins or unpins apps from "View more apps" and reorders them by drag
     ([Pin an app](https://support.microsoft.com/en-us/office/pin-an-app-for-easy-access-in-microsoft-teams-3045fd44-6604-4ba7-8ecc-1c0d525e89ec)).
   - **Admin app setup policies** pin apps and set their order, through an org-wide default
     policy and custom policies for groups. Admin pins come first, and user pins sit below them.
     A policy switch allows or blocks user pinning. When it is off, user pins go away. People
     cannot remove an app the admin installed
     ([App setup policies](https://learn.microsoft.com/en-us/microsoftteams/teams-app-setup-policies#considerations-and-limitations);
     [image](https://learn.microsoft.com/en-us/microsoftteams/media/teams-app-setup-policies/pinned-apps-teams-desktop.png)).
   - Quick views (@mentions, Followed threads) can be set to Always, When unread or Hide
     ([New chat and channels](https://support.microsoft.com/en-us/teams/teams-channels/explore-the-new-chat-and-channels-experience-in-microsoft-teams)).
2. **Sections and nesting.** Custom sections, up to 50 sections of 50 conversations. Items and
   whole sections move by drag
   ([Reorder chats and channels](https://support.microsoft.com/en-us/teams/teams-channels/reorder-chats-and-channels-in-microsoft-teams)).
   One level. Collapsing: unconfirmed.
3. **Rail plus sidebar.** A narrow app bar plus the chat and channels list. Hiding the list:
   unconfirmed.
4. **Placement.** The app bar is on the left on desktop and at the bottom on mobile. Activity is
   the first app-bar icon. Search is "the search box at the top of Teams"
   ([Search in Teams](https://support.microsoft.com/en-us/office/search-for-messages-and-more-in-microsoft-teams-4a351520-33f4-42ab-a5ee-5fc0ab88b263)).
   Neither moves.

## Frappe Gameplan

Files: `frontend/src/components/DesktopLayout.vue`, `components/AppRail/AppRail.vue`,
`components/AppRail/CustomizeSidebarDialog.vue`, `components/AppSidebar.vue`,
`data/pinnedSpaces.ts`, `data/sidebarPreferences.ts`.

1. **Adding rows.**
   - Rail shortcuts (Search, People, Notifications, Drafts) are fixed in code.
   - "Customize sidebar" opens from the logo's app menu. It sets the badge style ("Unread
     count" or "Dot") and splits the communities on the rail into "Shown in sidebar" and
     "Hidden from sidebar" lists with drag order. Save calls `GP Team/update_joined_teams` and
     stores the order. It is per person.
   - Each space row has a `…` menu with "Pin space". Pins are saved to `GP User Profile.pinned_spaces`.
   - The space list sorts by recent activity or alphabetically, and can hide inactive spaces
     (no activity for 2 months). These are kept in the browser's local storage.
2. **Sections and nesting.** One "Spaces" list, no nesting, no collapsing.
3. **Rail plus sidebar.** frappe-ui `DesktopShell` with `#rail` and `#sidebar`. The sidebar
   shows only on routes with `meta.communityScope`. On other pages the rail is alone. The
   sidebar is fixed at 14rem with `disable-collapse`. No dock or auto-hide.
4. **Placement.** The logo is at the top of the rail. Search and Notifications are rail rows
   right under it. The avatar is at the bottom. Nothing moves.

## Frappe CRM

Files: `frontend/src/components/Layouts/AppSidebar.vue`, `utils/navigation.js`,
`stores/views.js`, `components/ViewControls.vue`,
`crm/fcrm/doctype/crm_view_settings/crm_view_settings.py`.

1. **Adding rows.**
   - The main rows are a fixed list in code (`navigationItems`: Dashboard, Leads, Deals,
     Contacts, Organizations, Notes, Tasks, Call Logs). They cannot be added, hidden or
     reordered.
   - A saved view's menu has **"Pin View"** (private views, by the owner) and **"Make Public"**
     (Administrator or Sales Manager). Pinned views go to "Pinned Views" for that person.
     Public views go to "Public Views" for everyone. Making a view public unpins it
     (`crm_view_settings.public`).
2. **Sections and nesting.** Three sections: an unlabelled main group, "Public Views" and
   "Pinned Views". The labelled ones collapse. No nesting.
3. **Sidebar only.** The frappe-ui `Sidebar` collapses to icons with a "Collapse" row at the
   bottom. The state is in local storage (`isSidebarCollapsed`). No peek.
4. **Placement.** The app menu is at the top. Search (`⌘K`) and Notifications are the first
   rows. Notifications opens a panel next to the sidebar. Help and Collapse are at the bottom.
   Nothing moves.

## Frappe Helpdesk

Files: `desk/src/components/layouts/AppSidebar.vue`, `layouts/Sidebar.vue`,
`layouts/layoutSettings.ts`, `stores/sidebar.ts`, `composables/useView.ts`.

1. **Adding rows.**
   - The main rows are a fixed list (`agentPortalSidebarOptions`: Home, Dashboard, Tickets,
     Knowledge Base, Customers, Contacts, Call Logs). Call Logs shows only when calling is on.
   - Views use the same model as CRM. "Pin View" adds a view to "Private Views" for the owner.
     "Make Public" (managers) adds it to "Public Views" for everyone. View rows in the sidebar
     have a `…` menu with the view actions.
2. **Sections and nesting.** An unlabelled main group, "Public Views" and "Private Views". The
   labelled ones collapse, and the state is not saved. No nesting.
3. **Sidebar only.** It collapses to icons with `SidebarCollapseToggle`. The state is in local
   storage (`sidebar_is_expanded`). The border uses `border-e`, so it follows RTL.
4. **Placement.** The user menu is at the top. Search and Notifications are the first rows
   (on mobile Notifications is a page). The footer has banners, Help and the collapse toggle.
   Nothing moves.

## Patterns that recur

1. **The page adds the row, and an editor arranges it.** Most products add a row with a star or
   pin on the page itself: Linear, Attio, ClickUp, Jira, GitHub, Notion "Add view to sidebar",
   CRM and Helpdesk "Pin View", and Gameplan "Pin space". The "Customize sidebar" editor
   (Linear, Notion, Jira, ClickUp, Slack Preferences, Gameplan) mostly shows, hides and
   reorders rows that already exist.
2. **Hidden rows go to a "More" overflow** instead of disappearing: Linear, Slack, ClickUp and
   Jira. Some built-in rows cannot be hidden (ClickUp Home, More, Inbox; Attio built-ins).
3. **Saved views are the main row type.** A URL row is rare. Only Jira's space shortcuts
   (admin-set) are documented. Action rows are rare too: Notion's "New page" and "New chat",
   and the Search row in CRM and Helpdesk.
4. **Personal comes first. A shared default is a layer under it.** Notion presets (default or
   optional, and a member can change, remove and reset), Teams policies (admin pins first, user
   pins below, a switch to allow user pins), Slack sections shared by user group, and
   CRM/Helpdesk public views. Linear, Attio, ClickUp, GitHub and VS Code have no admin layer.
   **Reset to the default** is how a person goes back: Notion "Reset tab", VS Code "Reset View
   Locations".
5. **Nesting is shallow.** Custom sections or folders hold items, one level deep: Linear and
   Attio favorites folders, Slack and Teams sections, ClickUp one Subfolder level, Jira spaces.
   Only Notion's page tree has no limit, and that is content, not a nav setting. Sections
   collapse almost everywhere.
6. **A rail switches what the sidebar shows.** Slack (Home, DMs, Activity), ClickUp (Home,
   Spaces), Teams (apps), VS Code (view containers) and Gameplan (communities). Products with
   one kind of content use a sidebar only: Linear, Notion, Attio, Jira, GitHub, CRM, Helpdesk.
7. **Collapse is common. Auto-hide is less common.** Linear and Notion collapse the sidebar and
   show it again when the pointer hovers at the left edge, with a way to lock it open. ClickUp
   previews a rail item's sidebar on hover. Slack, ClickUp, CRM and Helpdesk collapse to icons
   only. VS Code has a toggle and Zen Mode, with no hover.
8. **Only VS Code moves the navigation to the right.** It is a per-user setting, and the
   secondary bar goes to the other side. VS Code also moves the rail to the top or bottom, or
   hides it. No other product surveyed has a left/right option.
9. **Search is at the top everywhere.** It is either in a top bar (Slack, ClickUp, Jira, GitHub,
   Teams) or the first sidebar or rail row (Notion, Attio, CRM, Helpdesk, Gameplan).
   Notifications are a top row of the sidebar (Linear, Attio, ClickUp, CRM, Helpdesk,
   Gameplan), a rail tab (Slack, Teams), the top bar (Jira, GitHub) or the status bar at the
   bottom (VS Code). **No product lets a person move search or notifications.** VS Code moves
   Accounts and Manage on its own when the rail moves.
10. **Small options sit next to the editor.** Badge as count or dot (Linear, Gameplan), "icons
    only" (Slack, ClickUp), a row limit for each section (Notion, ClickUp), a personal alias for
    a row (ClickUp), and hiding inactive items (Slack, Gameplan).
11. **Caps are stated.** Notion: 6 tabs, 25 shortcuts and 25 sections per tab. GitHub: 25 saved
    views. Teams: 50 sections of 50. ClickUp: 100 sections.

## Gaps

- No primary source says whether Linear, Attio or Teams sidebar sections nest, or whether Linear
  has a workspace sidebar default.
- No primary source documents hover peek in Slack, Jira Cloud or Teams.
- ClickUp help pages refuse automated fetches. They were read through the public Zendesk article
  API (`help.clickup.com/api/v2/help_center/en-us/articles/<id>.json`). The links above are the
  pages people read.
