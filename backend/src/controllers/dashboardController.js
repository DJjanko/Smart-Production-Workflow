import { getDashboardData } from "../services/workflowService.js";

export async function getDashboard(req, res, next) {
  try {
    res.json(await getDashboardData());
  } catch (error) {
    next(error);
  }
}
