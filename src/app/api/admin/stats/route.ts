import { connectDB } from '@/lib/mongodb';
import Endpoint from '@/models/Endpoint';
import HitLog from '@/models/HitLog';

export async function GET() {
  await connectDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalEndpoints, activeEndpoints, totalHits, hitsToday] = await Promise.all([
    Endpoint.countDocuments(),
    Endpoint.countDocuments({ isActive: true }),
    HitLog.countDocuments(),
    HitLog.countDocuments({ timestamp: { $gte: today } }),
  ]);

  // Top endpoints by hits
  const topEndpoints = await HitLog.aggregate([
    { $group: { _id: '$path', count: { $sum: 1 }, lastHit: { $max: '$timestamp' } } },
    { $sort: { count: -1 } },
    { $limit: 6 },
  ]);

  return Response.json({
    totalEndpoints,
    activeEndpoints,
    totalHits,
    hitsToday,
    topEndpoints,
  });
}
