import { Request, Response, NextFunction } from 'express';

let apiToken: string = '';

export function generateApiToken(): string {
  apiToken = Math.random().toString(36).substring(2, 18) + Math.random().toString(36).substring(2, 18);
  return apiToken;
}

export function getApiToken(): string {
  return apiToken;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!apiToken) {
    next();
    return;
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return;
  }
  
  const token = authHeader.substring(7);
  if (token !== apiToken) {
    res.status(401).json({ error: 'Unauthorized: Invalid API token' });
    return;
  }
  
  next();
}