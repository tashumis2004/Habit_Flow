# HabitFlow

HabitFlow is a daily habit tracker dashboard for managing routines, progress, and streaks. The current version keeps the original blue-and-white design while adding live functionality for heatmaps, achievements, goals, and settings.

## Features
- Habit creation, editing, completion, and deletion
- Daily checklist for quick progress updates
- Weekly and monthly reporting summaries
- Habit streak calculations and calendar tracking
- Heatmap overview with date detail popups
- Achievement and badge collection system
- Goal tracking with add, edit, toggle, and delete actions
- Light mode and dark mode support with saved preference state
- LocalStorage persistence for habits, goals, settings, theme, and achievements

## Project files
- [index.html](index.html) — dashboard shell, navigation, and section content
- [css/style.css](css/style.css) — visual styling, theme tokens, and responsive layout
- [js/app.js](js/app.js) — state management, rendering, persistence, and interactions

## How to run
1. From the project root, start a local HTTP server:

   python -m http.server 8000

2. Open the app in a browser:

   http://localhost:8000/HabitFlow/

## Functional modules
- Heatmap: view yearly activity and inspect completions for individual days
- Achievements: unlock and track progression based on current habit behavior
- Goals: create and update personal milestones without disrupting the main dashboard
- Settings: switch themes, manage preference toggles, and export or reset saved data

## Notes
The app preserves existing habit data while adding new functionality, and it keeps the original professional look intact across desktop and mobile layouts.
# HabitFlow Project

HabitFlow is a local-first habit tracker dashboard built with plain HTML, CSS, and JavaScript. The app keeps the Blue & White professional dashboard design while adding a working system for heatmaps, goals, achievements, and settings without disrupting the existing dashboard, calendar, and statistics features.

## Included features
- Daily habit tracking with persistent localStorage data
- Dashboard, My Habits, Calendar, and Statistics views
- Working Heatmap section with date detail popups
- Achievement tracking and progress summaries
- Goal creation, editing, completion toggling, and deletion
- Light and dark mode support with saved user preference
- Responsive layout for desktop and mobile screens
- Data export and reset controls for saved app state

## Run locally
1. Open the project root folder in a terminal:
   cd c:\xampp\htdocs\vertika\habit_tracker
2. Start a local web server:
   python -m http.server 8000
3. Visit the app in the browser:
   http://localhost:8000/HabitFlow/

## Project structure
- HabitFlow/index.html — app shell and dashboard section layout
- HabitFlow/css/style.css — core blue-and-white theme and responsive styling
- HabitFlow/js/app.js — habit logic, persistence, heatmap, goals, settings, and achievements
- HabitFlow/README.md — app-specific feature summary and run notes

## Verified behavior
- Dashboard, My Habits, Calendar, and Statistics remain intact while navigating between sections
- Heatmap click actions open a date detail modal with completed habits
- Achievement summaries update from habit progress and unlock states
- Goal items can be added, toggled, edited, and deleted without losing existing data
- Theme and settings preferences persist in localStorage
