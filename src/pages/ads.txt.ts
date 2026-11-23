import type { APIRoute } from 'astro';
import { adSensePublisherClient } from '../lib/monetization';

export const GET: APIRoute = () => new Response(
  `google.com, ${adSensePublisherClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`,
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
);
