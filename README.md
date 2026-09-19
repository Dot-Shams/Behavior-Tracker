# Behavior Tracker

A simple classroom behavior tracking app for logging student actions, reviewing recent behavior history, and displaying a quick visual dashboard.

## What this app does

This project is a web app with:
- a list of students
- a set of behavior buttons such as "helped friends" and "disrupted class"
- a live recent-history feed
- filters for all/today/positive/negative records
- sound and color flash feedback when a behavior is recorded

It stores data in Firebase Firestore, so changes appear in real time without refreshing the page.

## Project files

- `behavior-scorecard.html` – page layout and UI containers
- `scorelogic.js` – app logic, Firebase setup, student management, event handlers, filters
- `scorecard.css` – styling, colors, card layout, flash effects, history styling

## How the app works

The app is built around two main data collections in Firestore:

1. `students`
   - each student is a document like:
   - `{ id: "abc123", name: "Ava", createdAt: timestamp }`

2. `behaviors`
   - each behavior event is a document like:
   - `{ studentId: "abc123", behavior: "helped friends", timestamp: timestamp }`

When the page loads:
- `loadStudents()` reads the students collection
- `setupRealtimeUpdates()` subscribes to the behaviors collection
- `renderDashboard()` draws each student card with behavior buttons

When a teacher clicks a behavior button:
- `recordBehavior(studentId, behaviorName)` writes a new behavior event to Firestore
- then it triggers a green/red flash and a short sound

## UI flow

The app keeps a local `students` array in memory so it can render the cards quickly. It does not re-read Firestore for every single button click; instead, it writes the event and then the live listener updates the recent-history list automatically.

## Important mental model

The app is really just this:
- students list
- behavior event log
- live render on change

Everything else is feedback and presentation.

## How to add a new behavior

Edit the `behaviors` array in `scorelogic.js`:

```js
const behaviors = [
  { name: 'helped friends', type: 'positive' },
  { name: 'disrupted class', type: 'negative' },
  { name: 'completed work', type: 'positive' },
  { name: 'stayed focused', type: 'positive' },
  { name: 'participated', type: 'positive' }
];
```

To add a new behavior, add a new object with:
- a label
- a `type` of either `positive` or `negative`

The buttons will show automatically because the app maps over this array.

## How to change the dashboard

Most of the UI is built with this pattern:
- `renderDashboard()` creates all student cards
- `behaviors.map(...)` creates the buttons inside each card
- `filterBehaviors()` controls what recent events are visible

If you want to change the layout, start in `renderDashboard()` and then adjust the CSS in `scorecard.css`.

## What to simplify later

This project is functional, but a few things are worth cleaning up for long-term maintainability:

- move the Firebase config into environment variables or a separate config file
- keep one source of truth for student data instead of mixing local memory and Firestore
- split logic into smaller helper functions so each step is easier to reason about
- avoid using inline `onclick` HTML attributes when possible; event listeners in JS are cleaner

## Fast way to understand the code

If you want to read it without AI, read in this order:
1. `behavior-scorecard.html` for the page structure
2. `scorelogic.js` for the behavior flow
3. `scorecard.css` for styling and visual effects

## Run it locally

Open `behavior-scorecard.html` in a browser. The Firebase SDK is loaded directly from the web, so if your Firestore rules and project are configured, the app should work without a build tool.

## Security note

The Firebase config is currently embedded directly in `scorelogic.js`. That works for a prototype, but it is not a good long-term practice. If you keep using Firebase, move the config into a secure environment-specific setup and keep secrets out of the repository.

## Bottom line

This app is not magical. It is a simple pattern:
- collect student names
- save behavior events
- show recent events in real time
- give instant feedback

Once you understand that, the rest is just UI polish and data flow.
