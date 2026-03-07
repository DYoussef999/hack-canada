import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

/** POST /sandbox/simulate */
export async function simulateSandbox(data) {
  const res = await api.post("/sandbox/simulate", data);
  return res.data;
}

/** POST /optimizer/recommend */
export async function recommendLocations(data) {
  const res = await api.post("/optimizer/recommend", data);
  return res.data;
}

/** GET /dashboard/metrics */
export async function getDashboardMetrics() {
  const res = await api.get("/dashboard/metrics");
  return res.data;
}
