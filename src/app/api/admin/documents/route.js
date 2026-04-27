import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { templateBody, values, title } = await request.json();

    if (!templateBody || !values) {
      return NextResponse.json(
        { error: "templateBody and values are required" },
        { status: 400 }
      );
    }

    let filled = templateBody;
    for (const [key, value] of Object.entries(values)) {
      filled = filled.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "_______________");
    }

    return NextResponse.json({
      title: title || "Documento",
      content: filled,
    });
  } catch (err) {
    console.error("Document generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate document", details: err.message },
      { status: 500 }
    );
  }
}
