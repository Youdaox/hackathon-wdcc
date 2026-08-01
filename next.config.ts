import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next blocks cross-origin requests to the dev server by default, so a phone
   * hitting the Mac's LAN address is rejected until its origin is listed here.
   *
   * The wildcards cover the usual hotspot/campus-wifi ranges — the last octet
   * changes every time you reconnect, so pinning one address means editing this
   * file mid-demo. Development only; `next build` ignores it entirely.
   */
  allowedDevOrigins: ["172.20.10.*", "192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
