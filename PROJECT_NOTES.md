# Smart Production Workflow - Project Notes

## What We Built

Backend:
- Express backend runs on `http://localhost:3000`.
- Root test route exists at `/` and returns `Express backend is running.`
- MongoDB database name is `smart-production-workflow`.
- Backend has a structured folder layout:
  - `src/app.js`
  - `src/server.js`
  - `src/controllers`
  - `src/routes`
  - `src/models`
  - `src/services`
  - `src/middleware`
  - `src/config`
- Basic JWT login is implemented.
- Seed script resets the demo database and creates starter data.
- Demo admin login is:
  - email: `admin`
  - password: `admin`
- Initial models exist for users, employees, products, parts, inventory, orders, work orders, phases, part orders, and activity logs.
- Initial deterministic workflow exists for creating a work order from an assistant command.

Frontend:
- React frontend runs on `http://localhost:3001`.
- Vite is used as the React development/build tool.
- Frontend has a structured folder layout:
  - `src/components`
  - `src/pages`
  - `src/images`
  - `src/utils`
- Landing page uses React Bits `Silk` background.
- Landing page has a top glass navigation bar.
- Landing page center content uses a dark transparent panel.
- Login uses the fast test credentials `admin` / `admin`.
- Dashboard menu appears only after login.
- Sidebar is fixed on desktop.
- Sidebar includes:
  - Pregled
  - Izdelki
  - Zaloga
  - Zaposleni
  - Delovni nalogi
  - Primerjava
  - Nastavitve
  - My account
  - Odjava
- Logout clears local session and returns to the landing page.
- Dashboard has cards for active work orders, low inventory, employees, and LLM/MCP actions.
- Dashboard has sections for work orders, inventory, timeline, workload, activity log, and assistant command input.
- Assistant panel is now a dark transparent panel over the Silk background.
- Assistant title format is `Assistant OpenAI API` or `Assistant Ollama`.
- Scrollbars were styled.

## Important Decisions

- We are not using a manual refresh button as the normal refresh mechanism.
- After any successful action, the current page reloads its data from the backend.
- Pattern:

```js
await api.someAction(payload);
await loadCurrentPageData();
```

- This applies to all pages:
  - Dashboard
  - Users
  - Products
  - Parts/inventory
  - Employees
  - Orders
  - Work orders
  - Settings
  - Comparison
- Assistant-created workflows and manual form actions should both refresh current page variables after completion.
- MCP and real LLM integration come after the classic MERN workflow is stable.
- Ollama will be used with these installed local models:
  - `qwen3:8b`
  - `llama3.1:8b`
  - `deepseek-r1:8b`
- Planned model comparison:
  - OpenAI API as the primary cloud model.
  - `qwen3:8b` as the main local Ollama model for workflow/tool-style commands.
  - `llama3.1:8b` as the stable general local comparison model.
  - `deepseek-r1:8b` as the reasoning-focused local comparison model.

## Current Known Issues / Cleanup

- Remove the dashboard `Osvezi` button since refresh should happen after actions.
- Some dashboard pages are still placeholders in the sidebar; only the main dashboard is currently implemented.
- Need to add real pages for products, inventory, employees, orders, work orders, comparison, settings, and account.
- Need to add CRUD endpoints/controllers for each main entity.
- Need to improve role-based frontend behavior for admin vs worker.
- Need to decide whether the assistant command parser stays mock-only for now or gets replaced by OpenAI/Ollama adapters next.
- Need to verify package installs after adding:
  - `three`
  - `@react-three/fiber`
  - `ogl`
- Need to test frontend and backend after a fresh clone/install.

## Todo

### 1. Clean Dashboard

- Remove the `Osvezi` button.
- Keep `loadDashboard()` after assistant actions.
- Make dashboard cards and panels visually consistent over the Silk background.
- Confirm the fixed sidebar and internal scrolling feel right.

### 2. Add API CRUD Modules

Backend endpoints to add:
- Users
- Products
- Parts
- Inventory
- Employees
- Orders
- Work orders
- Work order phases

Each module should have:
- model
- controller
- route
- service if business logic is needed
- validation/checks

### 3. Add Frontend Pages

Create pages:
- `ProductsPage.jsx`
- `PartsInventoryPage.jsx`
- `EmployeesPage.jsx`
- `OrdersPage.jsx`
- `WorkOrdersPage.jsx`
- `ComparisonPage.jsx`
- `SettingsPage.jsx`
- `AccountPage.jsx`

Each page should:
- load its own data on mount
- submit create/update/delete actions through the API
- reload its own data after a successful action
- use reusable components where possible

### 4. Improve Navigation

- Add active page state/routing.
- Add React Router or simple local page switching.
- Sidebar buttons should navigate to real pages.
- `My account` should open account/profile page.

### 5. Manual Workflow Creation

Add manual form for creating a work order:
- customer name
- product
- quantity
- deadline

After submit:
- backend creates work order
- frontend reloads current page/dashboard data

### 6. Assistant Workflow Improvements

Short term:
- Keep deterministic parser.
- Add more supported commands:
  - check inventory
  - create work order
  - summarize work order
  - reschedule work order
  - employee workload

Later:
- Add OpenAI adapter.
- Add Ollama adapter.
- Add model comparison page.
- Store timing and result quality in `ActivityLog`.

### 7. MCP Layer

After the normal backend workflow is stable:
- Create MCP server.
- Expose tools:
  - `find_product`
  - `check_inventory`
  - `auto_order_missing_parts`
  - `reserve_inventory`
  - `generate_work_order_phases`
  - `assign_phases_to_employees`
  - `create_work_order`
  - `reschedule_work_order`
  - `get_employee_workload`
  - `summarize_work_order`
  - `process_customer_order`
- Connect backend/LLM flow to MCP tools.

### 8. Testing

Backend:
- Test seed script.
- Test login.
- Test dashboard endpoint.
- Test assistant command endpoint.
- Test CRUD endpoints after they are added.

Frontend:
- Test login/logout.
- Test dashboard loading.
- Test assistant command.
- Test page reload-after-action behavior.
- Test responsive layout.

### 9. Diploma Documentation Support

Keep notes for:
- architecture
- data model
- workflow steps
- deterministic business logic
- MCP tools
- LLM role vs backend/MCP role
- OpenAI vs Ollama comparison criteria
- activity log/evaluation data

## Suggested Implementation Order

1. Remove `Osvezi` and finalize dashboard refresh-after-action behavior.
2. Add page navigation/routing.
3. Implement Products CRUD.
4. Implement Parts + Inventory CRUD.
5. Implement Employees CRUD.
6. Implement Work Orders page.
7. Add manual work order creation form.
8. Expand assistant mock commands.
9. Add OpenAI/Ollama adapter structure.
10. Add MCP server and tools.
11. Add comparison page.
12. Add tests and polish.
