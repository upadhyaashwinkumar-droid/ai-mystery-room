import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" }
});

export function getErrorMessage(error) {
  return error.response?.data?.error || "We couldn't reach the investigation desk. Check your connection and try again.";
}

export default api;
