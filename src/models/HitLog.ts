import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IHitLog extends Document {
  timestamp: Date;
  method: string;
  path: string;
  ip: string;
  requestHeaders: object;
  requestBody: object;
  responseStatusCode: number;
  responseBody: object;
  endpointFound: boolean;
  durationMs: number;
}

const HitLogSchema = new Schema<IHitLog>(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    method: { type: String },
    path: { type: String, index: true },
    ip: { type: String },
    requestHeaders: { type: Schema.Types.Mixed },
    requestBody: { type: Schema.Types.Mixed },
    responseStatusCode: { type: Number },
    responseBody: { type: Schema.Types.Mixed },
    endpointFound: { type: Boolean },
    durationMs: { type: Number },
  },
  { timestamps: false }
);

const HitLog: Model<IHitLog> =
  mongoose.models.HitLog || mongoose.model<IHitLog>('HitLog', HitLogSchema, 'simulator1_hitlogs');


export default HitLog;
