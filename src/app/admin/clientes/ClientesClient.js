"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import styles from "../admin.module.css";
import { formataDoc } from "@/lib/clientes/doc";

export default function ClientesClient() {
  const [isPending, startTransition] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("pf");
  const [formErr, setFormErr] = useState(null);

  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [clientes, setClientes] = useState(null); // null = ainda carregando
  const [listErr, setListErr] = useState(null);

  async function carregar() {
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set("busca", busca.trim());
      if (incluirInativos) params.set("incluirInativos", "true");
      const res = await fetch(`/api/admin/clientes?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setListErr(data.error || "Falha ao buscar clientes.");
        return;
      }
      setListErr(null);
      setClientes(data.clientes || []);
    } catch {
      setListErr("Falha ao buscar clientes.");
    }
  }

  // Busca com debounce: espera 300ms sem digitar antes de chamar a API.
  useEffect(() => {
    let cancelado = false;
    const timer = setTimeout(() => {
      if (!cancelado) carregar();
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, incluirInativos]);

  function handleCreate(e) {
    e.preventDefault();
    setFormErr(null);
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/clientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormErr(data.error || "Falha ao criar o cliente.");
          return;
        }
        form.reset();
        setTipo("pf");
        setAberto(false);
        carregar();
      } catch {
        setFormErr("Falha ao criar o cliente.");
      }
    });
  }

  return (
    <>
      <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className={styles.pageTitle}>Clientes</h1>
          <p className={styles.pageSubtitle}>
            Busque um cliente pelo nome, CPF/CNPJ ou telefone e veja os carros dele
          </p>
        </div>
        <button onClick={() => setAberto((v) => !v)} className={styles.btnPrimary}>
          {aberto ? "Cancelar" : "+ Novo cliente"}
        </button>
      </div>

      {aberto && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate} className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome *</label>
              <input name="nome" className={styles.formInput} required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo</label>
              <select
                name="tipo"
                className={styles.formSelect}
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                <option value="pf">Pessoa física</option>
                <option value="pj">Pessoa jurídica</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CPF/CNPJ</label>
              <input name="doc" className={styles.formInput} placeholder="Só números ou com pontuação" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>RG</label>
              <input name="rg" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CNH</label>
              <input name="cnh" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Categoria</label>
              <input name="cnh_categoria" className={styles.formInput} placeholder="Ex: AB" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Telefone</label>
              <input name="telefone" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>E-mail</label>
              <input name="email" type="email" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CEP</label>
              <input name="cep" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Logradouro</label>
              <input name="logradouro" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Número</label>
              <input name="numero" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Complemento</label>
              <input name="complemento" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Bairro</label>
              <input name="bairro" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Município</label>
              <input name="municipio" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>UF</label>
              <input name="uf" className={styles.formInput} maxLength={2} style={{ textTransform: "uppercase" }} />
            </div>
            {tipo === "pj" && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Representante</label>
                  <input name="representante_nome" className={styles.formInput} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>CPF do representante</label>
                  <input name="representante_cpf" className={styles.formInput} />
                </div>
              </>
            )}
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Observações</label>
              <textarea name="obs" rows={2} className={styles.formTextarea} />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={isPending}>
                {isPending ? "Salvando…" : "Criar cliente"}
              </button>
            </div>
          </form>
          {formErr && <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginBottom: 0 }}>{formErr}</p>}
        </div>
      )}

      <div className={styles.card}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
            className={styles.formInput}
            style={{ flex: "1 1 280px" }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "#444", whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={incluirInativos}
              onChange={(e) => setIncluirInativos(e.target.checked)}
            />
            Incluir inativos
          </label>
        </div>

        {listErr && <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>{listErr}</p>}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CPF/CNPJ</th>
                <th>Telefone</th>
                <th>Carros</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes === null ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
                    Carregando…
                  </td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
                    {busca.trim()
                      ? "Nenhum cliente encontrado para essa busca."
                      : "Nenhum cliente cadastrado ainda."}
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id} style={{ opacity: c.ativo === false ? 0.6 : 1 }}>
                    <td>
                      <strong>{c.nome}</strong>
                      {c.email && (
                        <div style={{ fontSize: "0.82rem", color: "#666" }}>{c.email}</div>
                      )}
                    </td>
                    <td>{c.doc ? formataDoc(c.doc) : "—"}</td>
                    <td>{c.telefone || "—"}</td>
                    <td>{c.veiculos_count ?? 0}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <Link href={`/admin/clientes/${c.id}`} prefetch={false} className={`${styles.btnSecondary} ${styles.btnSmall}`}>
                          Abrir ficha
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
