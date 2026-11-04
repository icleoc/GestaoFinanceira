"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dados, Membro, Permissao, Sessao } from "@/lib/types";
import type { Convite } from "@/lib/data";
import { cancelarConvite, convidarPessoa, criarConvite, definirLimite, listarConvites, listarMembros, mudarPermissoes, removerPessoa } from "@/lib/data";
import { gastoPorPessoa, situacaoDoLimite } from "@/lib/limites";
import { monthOf, num, todayISO } from "@/lib/finance";
import { money } from "@/lib/format";
import { PAPEIS_PRONTOS, ROTULO_PERMISSAO, TODAS_PERMISSOES, nomeDoPapel, papelDe } from "@/lib/permissoes";

function senhaAleatoria(): string {
  const letras = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => letras[b % letras.length]).join("");
}

function EscolhaDePermissoes({
  valor,
  onChange,
  permitidas,
  idBase,
}: {
  valor: Permissao[];
  onChange: (v: Permissao[]) => void;
  permitidas: Permissao[];
  idBase: string;
}) {
  const papelAtual = papelDe(valor);
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Papel" className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1 sm:grid-cols-4">
        {PAPEIS_PRONTOS.map((p) => {
          const disponivel = p.permissoes.every((x) => permitidas.includes(x));
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={papelAtual === p.id}
              disabled={!disponivel}
              onClick={() => onChange([...p.permissoes])}
              title={p.descricao}
              className={`rounded-lg px-2 py-2 text-[13px] font-medium leading-tight transition-colors disabled:opacity-40 ${
                papelAtual === p.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {p.nome}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted">{PAPEIS_PRONTOS.find((p) => p.id === papelAtual)?.descricao}</p>
      <fieldset>
        <legend className="label">O que essa pessoa pode fazer</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {TODAS_PERMISSOES.map((p) => (
            <label key={p} htmlFor={`${idBase}-${p}`} className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2 hover:bg-sunken">
              <input
                id={`${idBase}-${p}`}
                type="checkbox"
                checked={valor.includes(p)}
                disabled={p === "ver" || !permitidas.includes(p)}
                onChange={(e) => onChange(e.target.checked ? [...valor, p] : valor.filter((x) => x !== p))}
                className="mt-0.5 size-4 accent-[rgb(var(--accent))]"
              />
              <span className="text-sm">
                <span className="block font-medium">{ROTULO_PERMISSAO[p].nome}</span>
                <span className="block text-muted">{ROTULO_PERMISSAO[p].descricao}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function LimiteDaPessoa({
  userId,
  atual,
  gasto,
  onSalvo,
  onErro,
}: {
  userId: string;
  atual: number;
  gasto: number;
  onSalvo: (msg: string) => void;
  onErro: (msg: string) => void;
}) {
  const [texto, setTexto] = useState(atual > 0 ? String(atual).replace(".", ",") : "");
  const [ocupado, setOcupado] = useState(false);
  const sit = atual > 0 ? situacaoDoLimite(gasto, atual) : null;

  async function salvar(valor: number | null) {
    setOcupado(true);
    try {
      await definirLimite(userId, valor);
      onSalvo(valor === null ? "Limite removido." : "Limite salvo.");
    } catch (e) {
      onErro(e instanceof Error ? e.message : "Não foi possível salvar o limite.");
    } finally {
      setOcupado(false);
    }
  }

  function aoSalvar(e: React.FormEvent) {
    e.preventDefault();
    const v = num(texto.replace(/\./g, "").replace(",", "."));
    if (!(v > 0)) return onErro("Informe um limite maior que zero.");
    void salvar(v);
  }

  return (
    <div className="mt-3 rounded-xl bg-sunken p-3">
      <p className="label !mb-1">Limite de gasto por mês</p>
      {sit && (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(sit.pct))} aria-label="Uso do limite do mês">
            <div className={`h-full rounded-full ${sit.estado === "ok" ? "bg-accent" : "bg-neg"}`} style={{ width: `${Math.min(100, sit.pct)}%` }} />
          </div>
          <p className={`num mt-1.5 text-sm ${sit.estado === "ok" ? "text-muted" : "font-medium text-neg"}`}>
            {sit.estado === "estourou"
              ? `Passou do limite: gastou ${money(sit.gasto)} de ${money(sit.limite)}`
              : `Gastou ${money(sit.gasto)} de ${money(sit.limite)} (restam ${money(sit.restante)})`}
          </p>
        </>
      )}
      <form onSubmit={aoSalvar} className="mt-2 flex gap-2">
        <input
          inputMode="decimal"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: 1500"
          aria-label="Limite mensal em reais"
          className="field num"
        />
        <button type="submit" disabled={ocupado} className="btn btn-quiet shrink-0 px-3">
          Salvar
        </button>
        {atual > 0 && (
          <button type="button" disabled={ocupado} onClick={() => void salvar(null)} className="btn btn-quiet shrink-0 px-3 text-neg">
            Tirar
          </button>
        )}
      </form>
      <p className="mt-1.5 text-xs text-muted">Quando a pessoa chegar a 80% e a 100%, ela vê um aviso no painel. Não bloqueia lançamentos.</p>
    </div>
  );
}

export default function Equipe({
  sessao,
  dados,
  onAviso,
  onMudou,
}: {
  sessao: Sessao;
  dados: Dados | null;
  onAviso: (m: string) => void;
  onMudou?: () => void;
}) {
  const gastos = dados ? gastoPorPessoa(dados.transacoes, dados.categorias, monthOf(todayISO())) : new Map<string, number>();
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      setMembros(await listarMembros());
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const carregarConvites = useCallback(async () => {
    try {
      setConvites(await listarConvites());
    } catch {
      setConvites([]);
    }
  }, []);
  useEffect(() => {
    void carregarConvites();
  }, [carregarConvites]);

  // convite por link
  const [modo, setModo] = useState<"link" | "direto">("link");
  const [convites, setConvites] = useState<Convite[]>([]);
  const [linkNovo, setLinkNovo] = useState<{ url: string; nome: string } | null>(null);
  const [copiadoLink, setCopiadoLink] = useState("");

  // criar acesso direto
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perms, setPerms] = useState<Permissao[]>(["ver", "lancar", "planejar"]);
  const [ocupado, setOcupado] = useState(false);
  const [criada, setCriada] = useState<{ email: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // edição
  const [editando, setEditando] = useState<string | null>(null);
  const [permsEdicao, setPermsEdicao] = useState<Permissao[]>([]);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const permitidas = sessao.papel === "dono" ? TODAS_PERMISSOES : sessao.permissoes;

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCriada(null);
    setOcupado(true);
    try {
      const r = await convidarPessoa({ nome, email, senha, permissoes: perms });
      setCriada(r.senhaTemporaria ? { email, senha: r.senhaTemporaria } : null);
      onAviso(r.senhaTemporaria ? "Acesso criado." : "Pessoa adicionada à carteira.");
      setNome("");
      setEmail("");
      setSenha("");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível adicionar.");
    } finally {
      setOcupado(false);
    }
  }

  const urlDoConvite = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/convite/${token}`;

  async function gerarConvite(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setLinkNovo(null);
    setOcupado(true);
    try {
      const { token } = await criarConvite({ nome, email, permissoes: perms });
      setLinkNovo({ url: urlDoConvite(token), nome: nome.trim() });
      setNome("");
      setEmail("");
      onAviso("Convite criado.");
      await carregarConvites();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar o convite.");
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar(token: string) {
    setErro("");
    try {
      await cancelarConvite(token);
      onAviso("Convite cancelado.");
      await carregarConvites();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível cancelar.");
    }
  }

  async function copiarLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiadoLink(url);
      setTimeout(() => setCopiadoLink(""), 2000);
    } catch {
      /* sem permissão para copiar: a pessoa copia na mão */
    }
  }

  const textoConvite = (url: string, quem: string) =>
    `${quem ? `Oi, ${quem}! ` : ""}Te convidei para a nossa carteira no Jarvis Finance. Abra o link, escolha seu nome e senha e já entra: ${url}`;

  async function salvarEdicao(userId: string) {
    setErro("");
    try {
      await mudarPermissoes(userId, permsEdicao);
      setEditando(null);
      onAviso("Permissões atualizadas.");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  async function remover(userId: string) {
    setErro("");
    try {
      await removerPessoa(userId);
      setRemovendo(null);
      onAviso("Pessoa removida.");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível remover.");
    }
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão para copiar: a pessoa copia na mão */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Pessoas e permissões</h2>
        <p className="mt-1 max-w-2xl text-muted">
          Quem tem acesso à carteira <b className="text-ink">{sessao.carteiraNome}</b> e o que cada um pode fazer. Os dados são só desta carteira: ninguém de fora enxerga nada.
        </p>
      </div>

      {erro && (
        <p role="alert" className="panel border-neg/40 p-4 text-sm font-medium text-neg">
          {erro}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="space-y-3" aria-labelledby="titulo-membros">
          <h3 id="titulo-membros" className="font-display text-lg font-semibold">
            Quem tem acesso
          </h3>
          {!membros && !erro && <p className="text-muted">Carregando…</p>}
          {membros?.map((m) => {
            const souEu = m.user_id === sessao.userId;
            const ehDono = m.papel === "dono";
            const intocavel = ehDono || souEu || (sessao.papel !== "dono" && m.permissoes.includes("equipe"));
            return (
              <article key={m.user_id} className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {m.nome || m.email} {souEu && <span className="font-normal text-muted">(você)</span>}
                    </p>
                    <p className="truncate text-sm text-muted">{m.email}</p>
                  </div>
                  <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold">{nomeDoPapel(m.papel)}</span>
                </div>
                {!ehDono || sessao.papel === "dono" ? (
                  <LimiteDaPessoa
                    key={`${m.user_id}-${num(dados?.limites?.find((l) => l.user_id === m.user_id)?.valor_mensal)}`}
                    userId={m.user_id}
                    atual={num(dados?.limites?.find((l) => l.user_id === m.user_id)?.valor_mensal)}
                    gasto={gastos.get(m.user_id) ?? 0}
                    onSalvo={(msg) => {
                      onAviso(msg);
                      onMudou?.();
                    }}
                    onErro={setErro}
                  />
                ) : null}
                {editando === m.user_id ? (
                  <div className="mt-4">
                    <EscolhaDePermissoes valor={permsEdicao} onChange={setPermsEdicao} permitidas={permitidas} idBase={`ed-${m.user_id}`} />
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => salvarEdicao(m.user_id)} className="btn btn-primary px-4 py-2">
                        Salvar
                      </button>
                      <button onClick={() => setEditando(null)} className="btn btn-quiet px-4 py-2">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-muted">{m.permissoes.map((p) => ROTULO_PERMISSAO[p].nome).join(" · ")}</p>
                    {!intocavel && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setEditando(m.user_id);
                            setPermsEdicao(m.permissoes);
                          }}
                          className="btn btn-quiet px-3 py-1.5"
                        >
                          Mudar permissões
                        </button>
                        {removendo === m.user_id ? (
                          <>
                            <button onClick={() => remover(m.user_id)} className="btn btn-danger px-3 py-1.5">
                              Confirmar remoção
                            </button>
                            <button onClick={() => setRemovendo(null)} className="btn btn-quiet px-3 py-1.5">
                              Não
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setRemovendo(m.user_id)} className="btn btn-quiet px-3 py-1.5 text-neg">
                            Remover
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </section>

        <section className="panel h-fit p-5 sm:p-6" aria-labelledby="titulo-convite">
          <h3 id="titulo-convite" className="font-display text-lg font-semibold">
            Adicionar pessoa
          </h3>
          <div role="radiogroup" aria-label="Como adicionar" className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1">
            {(
              [
                ["link", "Convidar por link"],
                ["direto", "Criar acesso agora"],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={modo === id}
                onClick={() => setModo(id)}
                className={"rounded-lg px-2 py-2 text-sm font-medium transition-colors " + (modo === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {modo === "link" ? (
            <>
              <p className="mt-3 text-sm text-muted">Escolha o acesso e gere um link. A pessoa abre, preenche o próprio nome e senha e já entra com o acesso que você definiu.</p>
              <form onSubmit={gerarConvite} className="mt-4 space-y-4" noValidate>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cv-nome" className="label">
                      Nome (opcional)
                    </label>
                    <input id="cv-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" />
                  </div>
                  <div>
                    <label htmlFor="cv-email" className="label">
                      E-mail (opcional)
                    </label>
                    <input id="cv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" autoComplete="off" />
                  </div>
                </div>
                <p className="-mt-2 text-xs text-muted">Se você informar o e-mail, só ele consegue usar o convite. O link vale 7 dias e uma vez só.</p>
                <EscolhaDePermissoes valor={perms} onChange={setPerms} permitidas={permitidas} idBase="conv" />
                <button type="submit" disabled={ocupado} className="btn btn-primary w-full py-3">
                  {ocupado ? "Gerando…" : "Gerar link de convite"}
                </button>
              </form>
              {linkNovo && (
                <div className="pop-in mt-4 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm" role="status">
                  <p className="font-semibold">Link pronto. Envie para a pessoa:</p>
                  <p className="num mt-2 break-all text-xs">{linkNovo.url}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => void copiarLink(linkNovo.url)} className="btn btn-quiet px-3 py-1.5">
                      {copiadoLink === linkNovo.url ? "Copiado" : "Copiar link"}
                    </button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(textoConvite(linkNovo.url, linkNovo.nome))}`} target="_blank" rel="noreferrer" className="btn btn-quiet px-3 py-1.5">
                      WhatsApp
                    </a>
                    <a href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Convite para o Jarvis Finance")}&body=${encodeURIComponent(textoConvite(linkNovo.url, linkNovo.nome))}`} className="btn btn-quiet px-3 py-1.5">
                      E-mail
                    </a>
                  </div>
                </div>
              )}
              {convites.length > 0 && (
                <div className="mt-5">
                  <p className="label">Convites abertos</p>
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {convites.map((c) => (
                      <li key={c.token} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{c.nome || c.email || "Sem nome"}</p>
                          <p className="text-xs text-muted">{c.permissoes.map((p) => ROTULO_PERMISSAO[p].nome).join(" · ")}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => void copiarLink(urlDoConvite(c.token))} className="btn btn-quiet px-2.5 py-1">
                            {copiadoLink === urlDoConvite(c.token) ? "Copiado" : "Copiar link"}
                          </button>
                          <button onClick={() => void cancelar(c.token)} className="btn btn-quiet px-2.5 py-1 text-neg">
                            Cancelar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
          <p className="mt-3 text-sm text-muted">Crie o acesso por você, com uma senha provisória, e passe os dados para a pessoa.</p>
          <form onSubmit={convidar} className="mt-4 space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="e-nome" className="label">
                  Nome
                </label>
                <input id="e-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" />
              </div>
              <div>
                <label htmlFor="e-email" className="label">
                  E-mail
                </label>
                <input id="e-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" autoComplete="off" />
              </div>
            </div>
            <div>
              <label htmlFor="e-senha" className="label">
                Senha provisória (mínimo 8 caracteres)
              </label>
              <div className="flex gap-2">
                <input id="e-senha" value={senha} onChange={(e) => setSenha(e.target.value)} className="field num" autoComplete="off" />
                <button type="button" onClick={() => setSenha(senhaAleatoria())} className="btn btn-quiet shrink-0 px-3">
                  Gerar
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">Se a pessoa já tem acesso ao sistema, a senha é ignorada e ela só entra na carteira.</p>
            </div>
            <EscolhaDePermissoes valor={perms} onChange={setPerms} permitidas={permitidas} idBase="novo" />
            <button type="submit" disabled={ocupado} className="btn btn-primary w-full py-3">
              {ocupado ? "Criando…" : "Criar acesso"}
            </button>
          </form>

          {criada && (
            <div className="pop-in mt-4 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm" role="status">
              <p className="font-semibold">Acesso criado. Passe estes dados para a pessoa:</p>
              <p className="num mt-2 break-all">
                E-mail: <b>{criada.email}</b>
                <br />
                Senha provisória: <b>{criada.senha}</b>
              </p>
              <button onClick={() => copiar(`E-mail: ${criada.email}\nSenha provisória: ${criada.senha}`)} className="btn btn-quiet mt-3 px-3 py-1.5">
                {copiado ? "Copiado" : "Copiar"}
              </button>
              <p className="mt-2 text-xs text-muted">Esta senha não aparece de novo. Peça para a pessoa trocá-la ao entrar.</p>
            </div>
          )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
