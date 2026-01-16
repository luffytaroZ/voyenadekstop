import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import RootLayout from './components/RootLayout';
import NotePage from './pages/NotePage';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';

// Root route with layout
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Auth route - sign in, sign up, forgot password
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: AuthPage,
});

// Home route - no note selected
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

// Note route - specific note selected
const noteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notes/$noteId',
  component: NotePage,
});

// Folder route - filter by folder
const folderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/folders/$folderId',
  component: HomePage,
});

// Folder + Note route
const folderNoteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/folders/$folderId/notes/$noteId',
  component: NotePage,
});

// Route tree
const routeTree = rootRoute.addChildren([
  authRoute,
  homeRoute,
  noteRoute,
  folderRoute,
  folderNoteRoute,
]);

// Create router
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Type registration for TypeScript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
