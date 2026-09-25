import api from "./client";

export async function startGoogleLogin() {
  const { data } = await api.get("/api/v1/auth/google");

  window.location.href = data.url;
}