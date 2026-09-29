# paseo-postgram-tasks

A [Paseo](https://paseo.sh) plugin that keeps a to-do list per project, stored as
[Postgram](https://github.com/ivo-toby/postgram) tasks. Write a quick note when something comes up,
refine it into a proper prompt over time, then hand it to an agent, in a new workspace or in the one
you're in.

## The Tasks panel

Every workspace gets a **Tasks** panel. On the desktop it opens in the right-hand sidebar; on iPhone,
iPad and Android it opens as a workspace tab, because the apps' fixed sidebar can't show plugin
panels. Open it from the sidebar, or with **Open Tasks** in the Command Center.

The panel shows the project's tasks in Postgram's order: **Inbox**, **Next**, **Active**,
**Waiting**, **Scheduled** and **Someday**, then the ten most recent **Done** tasks. Click a heading
to collapse or expand its section. Empty sections, Scheduled and Someday start collapsed, and so
does Done. The list refreshes every 30 seconds.

### Adding tasks

Type in the five-line box at the top and press **Add task**. On the desktop, Cmd or Ctrl+Enter also
adds it; Enter starts a new line. New tasks always go to Inbox, which opens if it was collapsed.

You can also type **`/task <text>`** in any agent's message box to save the text as an Inbox task.
Nothing is sent to the agent.

### Task cards

Each card shows the task's full text: the first line as its title, the rest below it. Its context
and tags appear as small labels. Click the text to open the editor. Done cards are dimmed.

Along the bottom of each card is a row of icon buttons. Hover over one to see its name, or
long-press it on a touch screen. Which buttons appear depends on the task's latest agent:

| Button | Shown when | What it does |
| --- | --- | --- |
| Run in new workspace | No agent yet, or its agent was archived | Opens the New workspace dialog (below). |
| Run in this workspace | No live agent | Sends the task to this workspace's agent (below). |
| Open agent | The latest agent still exists | Opens that agent. |
| Continue | The latest agent was archived, or the task is done | Sends that agent a message, which restores it if it was archived, and moves the task back to Active. |
| Open agent (host) | Once per earlier run | Opens an earlier run's agent on the host that ran it. |
| Copy text | Always | Copies the task's text. |
| Move to… | Always | Lists the other statuses to move the task to. Scheduling asks for a date first. |
| Delete | Always | Archives the task in Postgram. |

### Dragging between sections

Drag a card by the handle (⠿) on its left onto another section to change its status. The card lifts
and follows the pointer. Its old spot closes up, and a dashed slot opens under the heading of the
section it would land in, collapsed sections included. Near the top or bottom edge the list scrolls
by itself. Let go to drop the card into the slot. Let go over its own section, or outside the list,
to send it back. Dropping onto Done completes the task; dropping onto Scheduled asks for a date first.

Moves show immediately. If Postgram rejects one, you see the error and the list reloads.

### Editing

The editor has the task's text, its status, and under **More** its context, due date, scheduled
date and priority. Nothing is saved until you press **Save**, and the header shows when there are
unsaved changes. Leaving with unsaved changes asks whether to save, discard or keep editing.
**Done** and the run buttons save your changes first; **Delete** discards them. If the task was
changed somewhere else while you edited it, you choose to reload it or keep your version.

## Handing a task to an agent

### Run in new workspace

Opens a dialog laid out like Paseo's own New workspace screen:

- the project and host;
- **Local** (the project's main folder) or **New worktree**, with the branch to start from (empty
  means the default branch), for git projects;
- a message box prefilled with the task text, which you can edit;
- the model, thinking level and permission mode, which start out as the workspace's latest agent
  has them.

Press the send button to create the workspace and its agent. Paseo names the workspace from the
message. The task moves to Active and its card links to the agent. The model list is loaded when the
Tasks panel opens and kept per host, so the dialog opens straight away.

This is a copy of Paseo's screen, not the screen itself: plugins can't open Paseo's own dialog with
text filled in. Unlike the real one it has no attachments, voice input or terminal option, you can't
switch project or host, and the starting branch is typed rather than picked from a list.

### Run in this workspace

Sends the task text as a message to the agent you used most recently in the current workspace,
then opens that agent. If the workspace has no agent, it starts one there with the same model the
dialog would pick. The task moves to Active and its card links to the agent.

An agent that already existed isn't marked as belonging to the task, so archiving it doesn't mark
the task done. (Plugins can't put text into an agent's message box without sending it, so there is
no "fill in but don't send" option.)

### Status follows the agent

Agents started for a task carry a `postgram-task` label. On the host that runs the agent, the
plugin moves the task to Active when the agent starts a turn, and marks it done when the agent is
archived.

## How tasks are linked to projects

Each task is tagged `project:<task key>`. The task key defaults to the project's folder name,
lowercased, with other characters turned into dashes. Change it with **Change** at the top of the
panel. Keys are stored per host, so projects with the same key on different hosts share a list, and
you can give a project on one host its own list (for example `ops-server2`).

## Setup

1. Create a Postgram API key that is allowed the `task` type, with read and write access. A key
   restricted to memories can list zero tasks without an error, and then fails when you add one.
   Use one key per host (for example `paseo-tasks-<host>`), so you can revoke one without the others.
2. On each host running a Paseo daemon, create `~/.paseo/postgram-tasks.json` (or
   `$PASEO_HOME/postgram-tasks.json`), readable only by the daemon's user:

   ```sh
   umask 077
   cat > ~/.paseo/postgram-tasks.json <<'EOF'
   { "apiUrl": "https://postgram.example.com", "apiKey": "<key>" }
   EOF
   ```

   The key stays on the daemon; the app never sees it. The file is read on every request, so a new
   or fixed file works without reloading the plugin.
3. Install the plugin (Paseo 0.9.2 or later, with plugins enabled):

   ```sh
   paseo plugin install /path/to/paseo-postgram-tasks
   ```

## Deploying to several hosts

`scripts/deploy.sh [host ...]` copies this folder to each host over SSH and installs or reloads the
plugin there; `local` means this machine's daemon. List your hosts and SSH options in an untracked
`scripts/deploy.local`:

```sh
HOSTS=(local host-a host-b)
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10)
```

With no hosts given, the script deploys to all of them. For each host it prints the plugin's status,
whether its files match this folder (`current` or `stale`), and whether the host has its config
file. `scripts/deploy.sh --check` only reports.

Before copying, the script tries each remote host for up to 15 seconds. Hosts behind an SSH check
that needs approving in a browser (such as Headscale's check mode) are reported as
`needs-approval` with the link to open, and skipped, instead of stalling the deploy. Approve the link
and run the script again for those hosts.

## Development

```sh
npm install
npm test          # unit tests for the shared and server logic
npm run typecheck
```

The code is split by where it runs:

- `index.client.tsx` and `client/` run in the Paseo app: the panel, cards, editor, dialogs and
  dragging (`client/use-card-drag.ts`).
- `index.server.ts` and `server/` run in the Paseo daemon: the Postgram API client, the plugin's
  RPC handlers, and the agent events that keep task status in step.
- `shared/` holds the logic both sides use and that the tests cover: task grouping and editing
  drafts, drop targets for dragging, model choices, start options and the RPC contracts.

Plugin code in the app can only import React, React Native, `@getpaseo/plugin`, React Query and Zod,
so dragging is built on React Native's own `PanResponder` and `Animated`.
