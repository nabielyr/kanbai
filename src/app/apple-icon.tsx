import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// iOS home-screen icon: the logo mark on warm cream. iOS rounds the corners itself.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const logo = await readFile(join(process.cwd(), "src/app/icon.svg"), "utf8");

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FBF8F3",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse */}
      <img
        src={`data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`}
        width={132}
        height={132}
        alt=""
      />
    </div>,
    size,
  );
}
