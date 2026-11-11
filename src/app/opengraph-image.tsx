import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link preview: the headline beside a big card broken into small taped steps, in the
// same paper-and-tape style as the board. Rendered once at build time.

export const alt = "KanbAI: a kanban board whose AI breaks big tasks into small steps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fonts = join(process.cwd(), "src/assets/fonts");
const [heading, body, logo] = await Promise.all([
  readFile(join(fonts, "BricolageGrotesque-ExtraBold.ttf")),
  readFile(join(fonts, "Inter-Medium.ttf")),
  readFile(join(process.cwd(), "src/app/icon.svg"), "utf8"),
]);

const INK = "#1E1B2E";
const MUTED = "#6B6680";
const PAPER_SHADOW = "4px 5px 0 rgba(30, 27, 46, 0.12)";

const STEPS = [
  { title: "Pick a site template", minutes: 20, tape: "rgba(250, 214, 72, 0.75)", tilt: -2 },
  { title: "Write the about page", minutes: 45, tape: "rgba(255, 159, 67, 0.7)", tilt: 1.5 },
  { title: "Deploy to Vercel", minutes: 25, tape: "rgba(141, 232, 189, 0.85)", tilt: -1 },
];

function Tape({ color, tilt, width = 72 }: { color: string; tilt: number; width?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: -9,
        left: "50%",
        width,
        height: 18,
        marginLeft: -width / 2,
        background: color,
        transform: `rotate(${tilt}deg)`,
      }}
    />
  );
}

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 72px",
        background: "#FBF8F3",
        color: INK,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse */}
          <img
            src={`data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`}
            width={52}
            height={52}
            alt=""
          />
          <div style={{ display: "flex", fontFamily: "Bricolage", fontSize: 40 }}>
            <span>Kanb</span>
            {/* The renderer leaves a gap between the two colored halves; close it by hand. */}
            <span style={{ marginLeft: -6, color: "#6E4BF5" }}>AI</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 40,
            fontFamily: "Bricolage",
            fontSize: 84,
            lineHeight: 1,
            letterSpacing: -2,
          }}
        >
          <span>Big tasks,</span>
          <span style={{ color: "#E8602A" }}>bite-sized.</span>
        </div>
        <div
          style={{ display: "flex", marginTop: 28, fontSize: 28, color: MUTED, lineHeight: 1.35 }}
        >
          A kanban board whose AI breaks a big task into small steps you can start today.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 26 }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "26px 28px",
            background: "white",
            border: "2px solid #E9E2D6",
            borderRadius: 10,
            boxShadow: PAPER_SHADOW,
            transform: "rotate(-1.5deg)",
          }}
        >
          <Tape color="rgba(255, 112, 112, 0.7)" tilt={3} width={96} />
          <div style={{ display: "flex", fontFamily: "Bricolage", fontSize: 32 }}>
            Build my portfolio website
          </div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 20, color: MUTED }}>
            Feels huge. Where do I even start?
          </div>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginTop: 16,
              padding: "6px 14px",
              borderRadius: 999,
              background: "#6E4BF5",
              color: "white",
              fontSize: 20,
            }}
          >
            Chunk it
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingLeft: 44 }}>
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                background: "white",
                border: "2px solid #E9E2D6",
                borderRadius: 8,
                boxShadow: PAPER_SHADOW,
                transform: `rotate(${step.tilt}deg) translateX(${i * 10}px)`,
                fontSize: 22,
              }}
            >
              <Tape color={step.tape} tilt={-step.tilt * 2} width={56} />
              <span>{step.title}</span>
              <span style={{ color: MUTED, fontSize: 19 }}>{step.minutes} min</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Bricolage", data: heading, weight: 800, style: "normal" },
        { name: "Inter", data: body, weight: 500, style: "normal" },
      ],
    },
  );
}
