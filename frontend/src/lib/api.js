const API_BASE_URL = "http://localhost:5000/api";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      "Something went wrong with the API request"
    );
  }

  return data;
}

// Dashboard
export async function getDashboard() {
  return request("/dashboard");
}

// Queues
export async function getQueues() {
  return request("/queues");
}

// Predictions
export async function getPredictions() {
  return request("/predictions");
}

// Bottlenecks
export async function getBottlenecks() {
  return request("/bottlenecks");
}

// Recommendations
export async function getRecommendations() {
  return request("/recommendations");
}

// Monitoring
export async function getMonitoring() {
  return request("/monitoring");
}

// Simulation
export async function runSimulation(data) {
  return request("/simulation", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Approve recommendation
export async function approveRecommendation(id, approvedBy) {
  return request(`/recommendations/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({
      approvedBy,
    }),
  });
}

// Reject recommendation
export async function rejectRecommendation(id) {
  return request(`/recommendations/${id}/reject`, {
    method: "POST",
  });
}

export { API_BASE_URL };