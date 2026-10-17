import "server-only";

/** Chave da Anthropic limpa de espaços, aspas e de um "ANTHROPIC_API_KEY=" colado por engano. */
export function chaveAnthropic(): string {
  let v = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  v = v.replace(/^ANTHROPIC_API_KEY\s*=\s*/i, "").replace(/^["']|["']$/g, "").trim();
  return v;
}

export function estadoDaChaveAnthropic(): "ausente" | "formato-estranho" | "ok" {
  const v = chaveAnthropic();
  if (!v) return "ausente";
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(v) ? "ok" : "formato-estranho";
}
