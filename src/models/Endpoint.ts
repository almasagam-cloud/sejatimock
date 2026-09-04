import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEndpoint extends Document {
  path: string;          // e.g. "validate"
  method: string;        // POST, GET, etc.
  description: string;
  statusCode: number;
  responseBody: object;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EndpointSchema = new Schema<IEndpoint>(
  {
    path: { type: String, required: true, unique: true },
    method: { type: String, required: true, default: 'POST' },
    description: { type: String, default: '' },
    statusCode: { type: Number, default: 200 },
    responseBody: { type: Schema.Types.Mixed, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Endpoint: Model<IEndpoint> =
  mongoose.models.Endpoint || mongoose.model<IEndpoint>('Endpoint', EndpointSchema, 'simulator1_endpoints');


export default Endpoint;
