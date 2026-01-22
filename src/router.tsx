import { createRouter, createRoute, createRootRoute, Navigate } from '@tanstack/react-router';
import RootLayout from './components/RootLayout';
import HomePage from './pages/HomePage';
import NotePage from './pages/NotePage';
import EventsPage from './pages/EventsPage';
import CalendarPage from './pages/CalendarPage';
import BrainMapPage from './pages/BrainMapPage';
import DayTrackerPage from './pages/DayTrackerPage';

// Root layout - handles auth gating internally
const rootRoute = createRootRoute({
  component: RootLayout,
  // Redirect unknown routes to home (All Notes)
  notFoundComponent: () => <Navigate to="/" />,
});

// App routes (only accessible when authenticated)
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const noteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notes/$noteId',
  component: NotePage,
});

const folderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/folders/$folderId',
  component: HomePage,
});

const folderNoteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/folders/$folderId/notes/$noteId',
  component: NotePage,
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  component: EventsPage,
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarPage,
});

const brainMapsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/brain-maps',
  component: BrainMapPage,
});

const brainMapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/brain-maps/$brainMapId',
  component: BrainMapPage,
});

const dayTrackerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/day-tracker',
  component: DayTrackerPage,
});

// Build route tree
const routeTree = rootRoute.addChildren([
  homeRoute,
  noteRoute,
  folderRoute,
  folderNoteRoute,
  eventsRoute,
  calendarRoute,
  brainMapsRoute,
  brainMapRoute,
  dayTrackerRoute,
]);

// Export router
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Type registration
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
