# Performance & Optimization

## Bundle Analysis
ZoyaEdge includes automated bundle analysis to keep the frontend lightweight.

### Running Analysis
To generate a visual report of the frontend bundle:
```bash
npm run analyze
```
This will build the application and open `apps/web/stats.html` in your browser, showing the size of each dependency.

## Code Splitting Recommendations
- **Lazy Loading Components**: Use `React.lazy()` for routes and heavy components (e.g., charts, complex modals).
- **Dynamic Imports**: Use `import()` for libraries that are not needed on initial load (e.g., `xlsx`, `jspdf`, `papaparse`).

### Example (Route-based splitting)
```tsx
const Dashboard = React.lazy(() => import('@/pages/dashboard/DashboardPage'));
```

## Firestore Optimization
- **Indexing**: Ensure all composite queries have corresponding indexes in `firestore.indexes.json`.
- **Query Limits**: Always use `.limit()` for lists to prevent massive read spikes.
- **Snapshot Debouncing**: For real-time listeners, avoid excessive re-renders by using local state sync strategies.
- **Batched Writes**: Use `writeBatch()` for multiple related updates to ensure atomicity and reduce request count.

## Backend Performance
- **Rate Limiting**: Configured in `apps/server/src/core/middleware/rate-limit.middleware.ts`.
- **JSON Payload Limits**: Strictly enforced at 1MB to prevent memory exhaustion.
- **Async Execution**: Heavy tasks (AI analysis, email sending) should be awaited without blocking the main event loop when possible, or offloaded to background workers in larger scale deployments.
