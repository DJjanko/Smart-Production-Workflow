const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || data?.interpreted?.message || "Request failed.");
  }

  return data;
}

export const api = {
  login: (body) => request("/auth/login", { method: "POST", body }),
  dashboard: () => request("/dashboard"),
  products: () => request("/products"),
  createProduct: (body, token) => request("/products", { method: "POST", body, token }),
  updateProduct: (id, body, token) => request(`/products/${id}`, { method: "PUT", body, token }),
  deleteProduct: (id, token) => request(`/products/${id}`, { method: "DELETE", token }),
  productInventory: () => request("/product-inventory"),
  createProductInventory: (body, token) => request("/product-inventory", { method: "POST", body, token }),
  updateProductInventory: (id, body, token) => request(`/product-inventory/${id}`, { method: "PUT", body, token }),
  deleteProductInventory: (id, token) => request(`/product-inventory/${id}`, { method: "DELETE", token }),
  parts: () => request("/parts"),
  createPart: (body, token) => request("/parts", { method: "POST", body, token }),
  updatePart: (id, body, token) => request(`/parts/${id}`, { method: "PUT", body, token }),
  deletePart: (id, token) => request(`/parts/${id}`, { method: "DELETE", token }),
  inventory: () => request("/inventory"),
  createInventory: (body, token) => request("/inventory", { method: "POST", body, token }),
  updateInventory: (id, body, token) => request(`/inventory/${id}`, { method: "PUT", body, token }),
  deleteInventory: (id, token) => request(`/inventory/${id}`, { method: "DELETE", token }),
  employees: () => request("/employees"),
  createEmployee: (body, token) => request("/employees", { method: "POST", body, token }),
  updateEmployee: (id, body, token) => request(`/employees/${id}`, { method: "PUT", body, token }),
  deleteEmployee: (id, token) => request(`/employees/${id}`, { method: "DELETE", token }),
  orders: () => request("/orders"),
  createOrder: (body, token) => request("/orders", { method: "POST", body, token }),
  updateOrder: (id, body, token) => request(`/orders/${id}`, { method: "PUT", body, token }),
  deleteOrder: (id, token) => request(`/orders/${id}`, { method: "DELETE", token }),
  workOrders: () => request("/work-orders"),
  createWorkOrder: (body, token) => request("/work-orders", { method: "POST", body, token }),
  updateWorkOrder: (id, body, token) => request(`/work-orders/${id}`, { method: "PUT", body, token }),
  approveWorkOrder: (id, token) => request(`/work-orders/${id}/approve`, { method: "PUT", token }),
  deleteWorkOrder: (id, token) => request(`/work-orders/${id}`, { method: "DELETE", token }),
  workOrderPhases: () => request("/work-order-phases"),
  updateWorkOrderPhase: (id, body, token) => request(`/work-order-phases/${id}`, { method: "PUT", body, token }),
  deleteWorkOrderPhase: (id, token) => request(`/work-order-phases/${id}`, { method: "DELETE", token }),
  users: (token) => request("/users", { token }),
  createUser: (body, token) => request("/users", { method: "POST", body, token }),
  updateUser: (id, body, token) => request(`/users/${id}`, { method: "PUT", body, token }),
  deleteUser: (id, token) => request(`/users/${id}`, { method: "DELETE", token }),
  me: (token) => request("/me", { token }),
  updateMe: (body, token) => request("/me", { method: "PUT", body, token }),
  supplyAlerts: (token) => request("/supply-alerts", { token }),
  createSupplyAlert: (body, token) => request("/supply-alerts", { method: "POST", body, token }),
  resolveSupplyAlert: (id, token) => request(`/supply-alerts/${id}/resolve`, { method: "PUT", token }),
  activityLog: () => request("/activity-log"),
  runCommand: (body, token) => request("/ai/commands", { method: "POST", body, token }),
  pendingActions: (token) => request("/ai/pending-actions", { token }),
  acceptPendingAction: (id, token) => request(`/ai/pending-actions/${id}/accept`, { method: "PUT", token }),
  declinePendingAction: (id, token) => request(`/ai/pending-actions/${id}/decline`, { method: "PUT", token })
};
