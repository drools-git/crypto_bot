import type { NextConfig } from "next";
import os from "os";

// Get all local IP addresses to allow LAN development access
const getLocalIps = () => {
  const interfaces = os.networkInterfaces();
  const ips: string[] = ['localhost', '127.0.0.1'];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4') {
        ips.push(iface.address);
      }
    }
  }
  return ips;
};

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore: Next.js 15+ newly added property
  allowedDevOrigins: getLocalIps(),
};

export default nextConfig;
