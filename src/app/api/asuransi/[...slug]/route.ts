import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Endpoint from '@/models/Endpoint';
import HitLog from '@/models/HitLog';
import { seedDefaultEndpoints } from '@/lib/seed';

const API_KEY = process.env.API_KEY ?? 'rahasia_chatbot_qibos_2026';
let seeded = false;

async function ensureSeeded() {
  if (!seeded) {
    await seedDefaultEndpoints();
    seeded = true;
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY, Authorization',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function handleRequest(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const start = Date.now();
  const { slug } = await params;
  const path = slug.join('/');
  const method = request.method;

  // Get IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ??
    request.headers.get('x-real-ip') ??
    'unknown';

  // Parse request body
  let requestBody: object = {};
  try {
    requestBody = await request.json();
  } catch {
    // body might be empty
  }

  // Capture relevant headers (exclude sensitive ones except X-API-KEY for debug purposes)
  const requestHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (!['cookie', 'authorization'].includes(key.toLowerCase())) {
      requestHeaders[key] = value;
    }
  });

  await connectDB();
  await ensureSeeded();

  // Validate API Key
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== API_KEY) {
    const responseBody = { status: false, message: 'Akses ditolak. Token API Key tidak valid atau tidak disertakan.' };
    const durationMs = Date.now() - start;
    await HitLog.create({
      method,
      path,
      ip,
      requestHeaders,
      requestBody,
      responseStatusCode: 401,
      responseBody,
      endpointFound: false,
      durationMs,
    });
    return Response.json(responseBody, { status: 401, headers: corsHeaders() });
  }

  // Find endpoint config
  const endpoint = await Endpoint.findOne({ path, isActive: true });

  if (!endpoint) {
    const responseBody = { status: false, message: `Endpoint '${path}' tidak ditemukan atau tidak aktif.` };
    const durationMs = Date.now() - start;
    await HitLog.create({
      method,
      path,
      ip,
      requestHeaders,
      requestBody,
      responseStatusCode: 404,
      responseBody,
      endpointFound: false,
      durationMs,
    });
    return Response.json(responseBody, { status: 404, headers: corsHeaders() });
  }

  const responseBody = endpoint.responseBody;
  const durationMs = Date.now() - start;

  await HitLog.create({
    method,
    path,
    ip,
    requestHeaders,
    requestBody,
    responseStatusCode: endpoint.statusCode,
    responseBody,
    endpointFound: true,
    durationMs,
  });

  return Response.json(responseBody, { status: endpoint.statusCode, headers: corsHeaders() });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
