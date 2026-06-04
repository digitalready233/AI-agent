import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#141418",
          borderRadius: 9,
          border: "1px solid rgba(201, 169, 110, 0.45)",
          boxShadow: "0 0 20px rgba(201, 169, 110, 0.2)",
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: "linear-gradient(135deg, #e8d4a8 0%, #8a7044 100%)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
