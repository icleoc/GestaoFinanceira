"use client";

import { useRef, useState } from "react";
import { atualizarMeuNome, enviarMinhaFoto, removerMinhaFoto } from "@/lib/data";
import { recortarAvatar } from "@/lib/imagem";
import { rotuloBiometria } from "@/lib/passkey";
import type { Aviso, Dados, Sessao } from "@/lib/types";
import Avatar from "./Avatar";
import Equipe from "./Equipe";
import FaceId from "./FaceId";
import Modal from "./Modal";
import SincronizarCalendario from "./SincronizarCalendario";
import TrocarSenha from "./TrocarSenha";

export type AbaPerfil = "perfil" | "seguranca" | "pessoas";

interface Props {
  nomeAtual: string;
  email: string;
  userId?: string;
  avisos?: Aviso[];
  foto?: string | null;
  inicial: string;
  abaInicial?: AbaPerfil;
  /** Mostra a aba Pessoas (quem pode gerenciar a equipe). */
  sessao?: Sessao;
  dados?: Dados | null;
  podeEquipe?: boolean;
  biometria?: boolean;
  demo?: boolean;
  onClose: () => void;
  onFeito: (nome: string) => void;
  onAviso: (msg: string) => void;
  onMudou: () => void;
}

/** Tudo da pessoa num lugar só: perfil (foto e nome), segurança (biometria e senha) e, para quem gerencia, as pessoas da carteira. */
export default function PerfilModal({ nomeAtual, email, userId, avisos, foto, inicial, abaInicial = "perfil", sessao, dados, podeEquipe, biometria, demo, onClose, onFeito, onAviso, onMudou }: Props) {
  const [aba, setAba] = useState<AbaPerfil>(abaInicial);
  const [nome, setNome] = useState(nomeAtual);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [fotoAtual, setFotoAtual] = useState<string | null>(foto ?? null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const rotuloBio = rotuloBiometria();

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const limpo = nome.trim().replace(/\s+/g, " ");
    if (limpo.length < 2) return setErro("Escreva o seu nome.");
    if (limpo.length > 60) return setErro("Use até 60 letras.");
    setOcupado(true);
    try {
      await atualizarMeuNome(limpo);
      onFeito(limpo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setOcupado(false);
    }
  }

  async function trocarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro("");
    setEnviandoFoto(true);
    try {
      const url = await enviarMinhaFoto(await recortarAvatar(arquivo));
      setFotoAtual(url);
      onAviso("Foto atualizada.");
      onMudou();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar a foto.");
    }
    setEnviandoFoto(false);
  }

  async function tirarFoto() {
    setErro("");
    setEnviandoFoto(true);
    try {
      await removerMinhaFoto();
      setFotoAtual(null);
      onAviso("Foto removida.");
      onMudou();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível remover a foto.");
    }
    setEnviandoFoto(false);
  }

  const abas: { id: AbaPerfil; nome: string }[] = [
    { id: "perfil", nome: "Perfil" },
    { id: "seguranca", nome: "Segurança" },
    ...(podeEquipe && sessao && dados ? ([{ id: "pessoas", nome: "Pessoas" }] as { id: AbaPerfil; nome: string }[]) : []),
  ];

  return (
    <Modal titulo="Meu perfil" onClose={onClose} largura={aba === "pessoas" ? "xl" : "md"}>
      <div role="tablist" aria-label="Seções do perfil" className="flex gap-1 border-b border-line px-4">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${aba === a.id ? "border-gold-lo text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {a.nome}
          </button>
        ))}
      </div>

      <div>
        {aba === "perfil" && (
          <>
            <form onSubmit={salvar} className="space-y-4 p-5" noValidate>
              <div className="flex items-center gap-4">
                <Avatar foto={fotoAtual} inicial={inicial} tamanho="size-20" className="text-2xl" />
                <div className="flex flex-wrap gap-2">
                  <input ref={entrada} type="file" accept="image/*" onChange={trocarFoto} className="sr-only" id="p-foto" tabIndex={-1} />
                  <button type="button" onClick={() => entrada.current?.click()} disabled={enviandoFoto} className="btn btn-quiet px-3 py-2">
                    {enviandoFoto ? "Enviando…" : fotoAtual ? "Trocar foto" : "Colocar foto"}
                  </button>
                  {fotoAtual && (
                    <button type="button" onClick={tirarFoto} disabled={enviandoFoto} className="btn btn-quiet px-3 py-2 text-neg">
                      Remover
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="p-nome" className="label">
                  Nome de exibição
                </label>
                <input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="field" autoComplete="name" maxLength={60} placeholder="Seu nome completo ou como quer ser chamado" />
                <p className="mt-1 text-sm text-muted">É o nome que aparece na saudação, no extrato e para a família. O e-mail de acesso ({email}) não muda.</p>
              </div>
              {erro && (
                <p role="alert" className="text-sm font-medium text-neg">
                  {erro}
                </p>
              )}
              <button type="submit" disabled={ocupado} className="btn btn-primary w-full py-3">
                {ocupado ? "Salvando…" : "Salvar"}
              </button>
            </form>
            {userId && (
              <div className="border-t border-line p-5">
                <SincronizarCalendario userId={userId} avisos={avisos} />
              </div>
            )}
          </>
        )}

        {aba === "seguranca" && (
          <div className="divide-y divide-line">
            {biometria && !demo && (
              <section aria-label={`Entrar com ${rotuloBio}`}>
                <h3 className="px-5 pt-5 font-display text-base font-semibold">Entrar com {rotuloBio}</h3>
                <FaceId embutido onClose={onClose} />
              </section>
            )}
            {!demo ? (
              <section aria-label="Trocar senha">
                <h3 className="px-5 pt-5 font-display text-base font-semibold">Trocar senha</h3>
                <TrocarSenha embutido onClose={onClose} onFeito={() => onAviso("Senha alterada.")} />
              </section>
            ) : (
              <p className="p-5 text-sm text-muted">Na demonstração não há senha nem biometria para configurar.</p>
            )}
          </div>
        )}

        {aba === "pessoas" && podeEquipe && sessao && dados && (
          <div className="p-4 sm:p-5">
            <Equipe sessao={sessao} dados={dados} onAviso={onAviso} onMudou={onMudou} />
          </div>
        )}
      </div>
    </Modal>
  );
}
