import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Endpoint from '@/models/Endpoint';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// PUT update endpoint
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const body = await request.json();
  const endpoint = await Endpoint.findByIdAndUpdate(id, body, { new: true });
  if (!endpoint) return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  return Response.json({ data: endpoint }, { headers: corsHeaders() });
}

// DELETE endpoint
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  await Endpoint.findByIdAndDelete(id);
  return Response.json({ success: true }, { headers: corsHeaders() });
}
