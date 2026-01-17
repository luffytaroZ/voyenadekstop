import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import RootLayout from './components/RootLayout';
import HomePage from './pages/HomePage';
import NotePage from './pages/NotePage';

// Root layout - handles auth gating internally
const rootRoute = createRootRoute({
  component: RootLayout,
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

// Build route tree
const routeTree = rootRoute.addChildren([
  homeRoute,
  noteRoute,
  folderRoute,
  folderNoteRoute,
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
