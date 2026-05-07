# Smart Production Workflow

MERN prototype for a production planning workflow described in `Izvedbeni_nacrt_diplomsko_delo_MCP_LLM_posodobljeno_v2.docx`.

The first implementation slice contains:

- Express API with MongoDB models for users, products, parts, inventory, employees, orders, work orders, phases, part orders, and activity logs.
- Backend `app.js`, routes, controllers, services, middleware, models, and config folders.
- Seed data for two products, five parts, inventory, admin/worker users, and employees.
- Deterministic work-order workflow: check inventory, simulate missing-part ordering, reserve stock, create an order, create a work order, generate phases, and assign employees by skill/availability.
- React dashboard split into `pages`, `components`, `utils`, and `images`.

## Requirements

- Node.js and npm
- MongoDB running locally

Default backend connection:

```txt
mongodb://127.0.0.1:27017/smart-production-workflow
```

## First Run

Open one CMD/PowerShell window for the backend:

```bash
cd D:\ZaključnoDelo\Smart-Production-Workflow\backend
npm install
npm run seed
npm run dev
```

Open another CMD/PowerShell window for the frontend:

```bash
cd D:\ZaključnoDelo\Smart-Production-Workflow\frontend
npm install
npm run dev
```

Then open:

```txt
http://localhost:3001
```

Backend API:

```txt
http://localhost:3000/api/health
```

Demo login:

```txt
admin
admin
```

## Demo Command

Use this in the copilot panel:

```txt
Ustvari delovni nalog za 5 kosov izdelka Kovinsko ohisje A za podjetje AluTech do petka.
```

The current copilot interpreter is deterministic. OpenAI, Ollama, and MCP integration are planned next layers after the base MERN workflow is stable.
