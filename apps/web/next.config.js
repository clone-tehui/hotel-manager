/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow MUI server components
  transpilePackages: ['@mui/material', '@mui/icons-material'],
};

module.exports = nextConfig;
