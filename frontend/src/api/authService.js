/** Auth service - login / register / google session / me / logout. */
import client from "./client";

export const authService = {
  register: (payload) => client.post("/auth/register", payload).then((r) => r.data),
  login: (payload) => client.post("/auth/login", payload).then((r) => r.data),
  googleSession: (session_id) => client.post("/auth/google/session", { session_id }).then((r) => r.data),
  me: () => client.get("/auth/me").then((r) => r.data),
  logout: () => client.post("/auth/logout").then((r) => r.data),
};
