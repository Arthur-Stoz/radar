import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native / heavy server-only packages stay out of the bundle.
  serverExternalPackages: ['better-sqlite3', '@huggingface/transformers', 'onnxruntime-node', 'sharp'],
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
