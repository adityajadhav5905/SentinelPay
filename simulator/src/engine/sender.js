import axios from 'axios';

/**
 * Send a transaction to SentinelPay's ingestion endpoint.
 * Returns { success, responseTime, status, error }
 */
export async function sendTransaction(tx, apiUrl, jwtToken) {
  const startTime = performance.now();

  // Strip internal _meta before sending
  const { _meta, ...payload } = tx;

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (jwtToken) {
      if (jwtToken.startsWith('sk_')) {
        headers['x-api-key'] = jwtToken;
      } else {
        headers['Authorization'] = `Bearer ${jwtToken}`;
      }
    }

    const response = await axios.post(apiUrl, payload, {
      headers,
      timeout: 10000,
    });

    const responseTime = Math.round(performance.now() - startTime);

    return {
      success: true,
      responseTime,
      status: response.status,
      data: response.data,
      error: null,
    };
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);

    return {
      success: false,
      responseTime,
      status: error.response?.status || 0,
      data: null,
      error: error.response?.data?.error || error.message,
    };
  }
}

/**
 * Test the connection to the API endpoint.
 */
export async function testConnection(apiUrl, jwtToken) {
  try {
    // Try a simple OPTIONS or HEAD request, or just a POST with minimal payload
    // that should return a validation error (400) rather than auth error (401)
    const headers = { 'Content-Type': 'application/json' };
    if (jwtToken) {
        if (jwtToken.startsWith('sk_')) {
            headers['x-api-key'] = jwtToken;
        } else {
            headers['Authorization'] = `Bearer ${jwtToken}`;
        }
    }

    const response = await axios.post(
      apiUrl,
      { txId: 'test_ping', amount: 1, currency: 'INR', userId: 'test', timestamp: new Date().toISOString() },
      {
        headers,
        timeout: 5000,
        validateStatus: () => true, // Don't throw on any status
      }
    );

    if (response.status === 401 || response.status === 403) {
      return { connected: false, message: `Auth failed (${response.status}): Check your JWT token` };
    }

    // 202 = accepted, 400 = validation (still connected), 2xx = ok
    return {
      connected: true,
      message: `Connected! (HTTP ${response.status})`,
      userId: response.data?.traceId ? 'Auth OK' : 'Connected',
    };
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      return { connected: false, message: 'Connection refused — is the server running?' };
    }
    return { connected: false, message: error.message };
  }
}
