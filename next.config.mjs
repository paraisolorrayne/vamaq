/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    "sharp",
    "@imgly/background-removal-node",
    "onnxruntime-node",
  ],
};

export default nextConfig;
