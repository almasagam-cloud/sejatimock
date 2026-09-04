import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import HitLog from '@/models/HitLog';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// GET logs with optional filtering
export async function GET(request: NextRequest) {
  await connectDB();
  const { searchParams } = request.nextUrl;
  const path = searchParams.get('path');
  const limit = parseInt(searchParams.get('limit') ?? '100');
  const page = parseInt(searchParams.get('page') ?? '1');
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (path) filter.path = path;

  const [logs, total] = await Promise.all([
    HitLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    HitLog.countDocuments(filter),
  ]);

  return Response.json({ data: logs, total, page, limit }, { headers: corsHeaders() });
}

// DELETE clear all logs
export async function DELETE() {
  await connectDB();
  const result = await HitLog.deleteMany({});
  return Response.json({ deleted: result.deletedCount }, { headers: corsHeaders() });
}
