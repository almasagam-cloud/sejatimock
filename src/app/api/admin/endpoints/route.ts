import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Endpoint from '@/models/Endpoint';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// GET all endpoints
export async function GET() {
  await connectDB();
  const endpoints = await Endpoint.find({}).sort({ createdAt: -1 }).lean();
  return Response.json({ data: endpoints }, { headers: corsHeaders() });
}

// POST create new endpoint
export async function POST(request: NextRequest) {
  await connectDB();
  const body = await request.json();
  const { path, method, description, statusCode, responseBody, isActive } = body;

  if (!path || !responseBody) {
    return Response.json({ error: 'path dan responseBody wajib diisi' }, { status: 400, headers: corsHeaders() });
  }

  try {
    const endpoint = await Endpoint.create({ path, method, description, statusCode, responseBody, isActive });
    return Response.json({ data: endpoint }, { status: 201, headers: corsHeaders() });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      return Response.json({ error: `Path '${path}' sudah ada` }, { status: 409, headers: corsHeaders() });
    }
    throw err;
  }
}
