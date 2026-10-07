import { Request, Response } from 'express';
import { EventEmitter } from 'events';

interface SSEClient {
  id: string;
  userId: string;
  res: Response;
}

class SSEManager extends EventEmitter {
  private clients: SSEClient[] = [];

  constructor() {
    super();
    this.startHeartbeat();
  }

  /**
   * Subscribe a client to SSE updates
   */
  public subscribe(req: Request, res: Response, userId: string) {
    // SSE Headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Prevent Nginx buffering
    });

    const clientId = Math.random().toString(36).substring(7);
    const newClient: SSEClient = { id: clientId, userId, res };

    this.clients.push(newClient);

    // Initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    console.log(`✅ [SSE] Client connected: ${userId} (${clientId})`);

    // Remove client on close
    req.on('close', () => {
      console.log(`❌ [SSE] Client disconnected: ${userId} (${clientId})`);
      this.clients = this.clients.filter(c => c.id !== clientId);
    });
  }

  /**
   * Broadcast an event to a specific user's connected clients
   */
  public sendToUser(userId: string, eventType: string, data: any) {
    const userClients = this.clients.filter(c => c.userId === userId);

    if (userClients.length === 0) return;

    const payload = JSON.stringify({ type: eventType, data });

    userClients.forEach(client => {
      client.res.write(`data: ${payload}\n\n`);
    });
  }

  /**
   * Keep connections alive with a heartbeat every 30s
   */
  private startHeartbeat() {
    setInterval(() => {
      this.clients.forEach(client => {
        client.res.write(': heartbeat\n\n');
      });
    }, 30000);
  }
}

export const sseManager = new SSEManager();
