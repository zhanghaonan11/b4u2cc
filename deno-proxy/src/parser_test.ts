import { ToolifyParser } from "./parser.ts";

function feed(parser: ToolifyParser, text: string) {
  for (const char of text) {
    parser.feedChar(char);
  }
}

Deno.test("ToolifyParser emits text and tool_call events", () => {
  // thinkingEnabled 对仅工具解析的场景无影响
  const parser = new ToolifyParser("<<CALL_aa11>>", false);
  const input =
    `Thoughts...<<CALL_aa11>>\n<invoke name="get_weather">\n<parameter name="city">"New York"</parameter>\n<parameter name="unit">"c"</parameter>\n</invoke>\n`;
  feed(parser, input);
  parser.finish();
  const events = parser.consumeEvents();

  const textEvent = events.find((e) => e.type === "text");
  if (!textEvent || textEvent.type !== "text") {
    throw new Error("Expected text event");
  }
  if (!textEvent.content.includes("Thoughts")) {
    throw new Error("Text event missing content");
  }

  const toolEvent = events.find((e) => e.type === "tool_call");
  if (!toolEvent || toolEvent.type !== "tool_call") {
    throw new Error("Expected tool call event");
  }
  if (toolEvent.call.name !== "get_weather") {
    throw new Error("Tool call name mismatch");
  }
  if (toolEvent.call.arguments.city !== "New York") {
    throw new Error("Tool arguments not parsed");
  }
});

Deno.test("ToolifyParser parses thinking blocks when no triggerSignal and thinking enabled", () => {
  // 无 triggerSignal 且显式开启思考解析：解析 <thinking> 为 thinking 事件
  const parser = new ToolifyParser(undefined, true);
  const input = "Intro text<thinking> internal chain-of-thought </thinking>Outro";
  feed(parser, input);
  parser.finish();
  const events = parser.consumeEvents();

  const textEvents = events.filter((e) => e.type === "text") as { type: "text"; content: string }[];
  const thinkingEvents = events.filter((e) => e.type === "thinking") as { type: "thinking"; content: string }[];

  if (thinkingEvents.length !== 1) {
    throw new Error(`Expected exactly one thinking event, got ${thinkingEvents.length}`);
  }
  const thinking = thinkingEvents[0].content;
  if (!thinking.includes("internal chain-of-thought")) {
    throw new Error(`Thinking content not parsed correctly: ${thinking}`);
  }

  if (!textEvents.length) {
    throw new Error("Expected at least one text event");
  }
  const combinedText = textEvents.map((e) => e.content).join("");
  if (!combinedText.includes("Intro text") || !combinedText.includes("Outro")) {
    throw new Error(`Text events missing expected text content: ${combinedText}`);
  }
});

Deno.test("ToolifyParser treats thinking tags as text when thinking disabled", () => {
  // 未开启思考解析时，即使出现 <thinking> 标签也应该作为普通文本处理
  const parser = new ToolifyParser(undefined, false);
  const input = "Intro <thinking>hidden</thinking> Outro";
  feed(parser, input);
  parser.finish();
  const events = parser.consumeEvents();

  const thinkingEvents = events.filter((e) => e.type === "thinking");
  if (thinkingEvents.length !== 0) {
    throw new Error(`Expected no thinking events when thinking disabled, got ${thinkingEvents.length}`);
  }

  const textEvents = events.filter((e) => e.type === "text") as { type: "text"; content: string }[];
  const combinedText = textEvents.map((e) => e.content).join("");
  if (!combinedText.includes("<thinking>hidden</thinking>")) {
    throw new Error(`Expected thinking tags to be preserved as text, got: ${combinedText}`);
  }
});
