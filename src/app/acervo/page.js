"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import VehicleCard from "@/components/VehicleCard";
import {
  getAllVehicles,
  getBrands,
  getBodyTypes,
  getFuelTypes,
  sortVehicles,
} from "@/data/vehicles";
import styles from "./acervo.module.css";

const PAGE_SIZE = 9;

const SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "brand", label: "Marca (A-Z)" },
  { value: "brandDesc", label: "Marca (Z-A)" },
  { value: "quilometragem", label: "Menor quilometragem" },
  { value: "quilometragemDesc", label: "Maior quilometragem" },
  { value: "yearAsc", label: "Ano (mais antigo)" },
  { value: "yearDesc", label: "Ano (mais novo)" },
];

export default function AcervoPage() {
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedFuels, setSelectedFuels] = useState([]);
  const [maxYear, setMaxYear] = useState("");
  const [maxQuilometragem, setMaxQuilometragem] = useState("");
  const [armored, setArmored] = useState("todos");
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const brands = getBrands();
  const bodyTypes = getBodyTypes();
  const fuelTypes = getFuelTypes();

  const filteredVehicles = useMemo(() => {
    const filters = {};
    if (selectedBrands.length) filters.brand = selectedBrands;
    if (selectedTypes.length) filters.bodyType = selectedTypes;
    if (selectedFuels.length) filters.fuel = selectedFuels;
    if (maxYear) filters.maxYear = Number(maxYear);
    if (maxQuilometragem) filters.maxQuilometragem = Number(maxQuilometragem);

    let result = getAllVehicles(filters);

    if (armored === "sim") {
      result = result.filter((v) => v.badge === "Blindado");
    } else if (armored === "nao") {
      result = result.filter((v) => v.badge !== "Blindado");
    }

    const sortKey = sortBy.replace("Desc", "");
    const desc = sortBy.endsWith("Desc");
    let sorted;
    if (sortBy === "yearAsc") {
      sorted = [...result].sort((a, b) => a.year - b.year);
    } else if (sortBy === "yearDesc" || sortBy === "recent") {
      sorted = [...result].sort((a, b) => b.year - a.year);
    } else if (sortKey === "quilometragem") {
      sorted = [...result].sort((a, b) => (desc ? b.quilometragem - a.quilometragem : a.quilometragem - b.quilometragem));
    } else if (sortKey === "brand") {
      sorted = [...result].sort((a, b) =>
        desc ? b.brand.localeCompare(a.brand) : a.brand.localeCompare(b.brand)
      );
    } else {
      sorted = sortVehicles(result, "recent");
    }

    return sorted;
  }, [selectedBrands, selectedTypes, selectedFuels, maxYear, maxQuilometragem, armored, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = filteredVehicles.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const toggleFilter = (value, list, setter) => {
    setPage(1);
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedTypes([]);
    setSelectedFuels([]);
    setMaxYear("");
    setMaxQuilometragem("");
    setArmored("todos");
    setPage(1);
  };

  const sidebar = (
    <div className={styles.sidebarInner}>
      <div className={styles.sidebarHeader}>
        <h2 className={styles.sidebarTitle}>Filtros</h2>
        <button
          className={styles.sidebarClose}
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar filtros"
          type="button"
        >
          &times;
        </button>
      </div>

      <FilterGroup label="Marca">
        <div className={styles.checkList}>
          {brands.map((brand) => (
            <label key={brand} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand)}
                onChange={() => toggleFilter(brand, selectedBrands, setSelectedBrands)}
              />
              <span>{brand}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Tipo de veículo">
        <div className={styles.checkList}>
          {bodyTypes.map((type) => (
            <label key={type} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={selectedTypes.includes(type)}
                onChange={() => toggleFilter(type, selectedTypes, setSelectedTypes)}
              />
              <span>{type}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Ano">
        <div className={styles.inputRow}>
          <span className={styles.inputPrefix}>Até</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="2025"
            min="2000"
            max="2030"
            value={maxYear}
            onChange={(e) => {
              setMaxYear(e.target.value);
              setPage(1);
            }}
            className={styles.input}
          />
        </div>
      </FilterGroup>

      <FilterGroup label="Quilometragem">
        <div className={styles.inputRow}>
          <span className={styles.inputPrefix}>Até</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="50.000"
            min="0"
            step="1000"
            value={maxQuilometragem}
            onChange={(e) => {
              setMaxQuilometragem(e.target.value);
              setPage(1);
            }}
            className={styles.input}
          />
          <span className={styles.inputSuffix}>km</span>
        </div>
      </FilterGroup>

      <FilterGroup label="Combustível">
        <div className={styles.checkList}>
          {fuelTypes.map((fuel) => (
            <label key={fuel} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={selectedFuels.includes(fuel)}
                onChange={() => toggleFilter(fuel, selectedFuels, setSelectedFuels)}
              />
              <span>{fuel}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Blindagem">
        <div className={styles.radioRow}>
          {[
            { value: "todos", label: "Todos" },
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
          ].map((opt) => (
            <label key={opt.value} className={styles.radioItem}>
              <input
                type="radio"
                name="armored"
                value={opt.value}
                checked={armored === opt.value}
                onChange={() => {
                  setArmored(opt.value);
                  setPage(1);
                }}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      <button
        type="button"
        className={styles.clearBtn}
        onClick={clearFilters}
      >
        Limpar filtros
      </button>
    </div>
  );

  return (
    <>
      <Header />
      <main id="main-content" className={styles.page}>
        <div className="container">
          <nav className={styles.breadcrumb} aria-label="Navegação">
            <Link href="/">Início</Link>
            <span aria-hidden="true"> / </span>
            <span>Acervo</span>
          </nav>

          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Nosso Acervo</h1>
              <p className={styles.subtitle}>
                {filteredVehicles.length} veículo
                {filteredVehicles.length !== 1 ? "s" : ""} disponíve
                {filteredVehicles.length !== 1 ? "is" : "l"} — curadoria rigorosa, procedência garantida.
              </p>
            </div>
          </header>

          <div className={styles.layout}>
            <aside
              className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) setSidebarOpen(false);
              }}
              aria-label="Filtros"
            >
              {sidebar}
            </aside>

            <div className={styles.results}>
              <div className={styles.toolbar}>
                <button
                  type="button"
                  className={styles.filterToggle}
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Abrir filtros"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 6h16M7 12h10M10 18h4" />
                  </svg>
                  Filtrar
                </button>

                <label className={styles.sortWrap}>
                  <span className={styles.sortLabel}>Ordenar por</span>
                  <select
                    className={styles.sort}
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Ordenar veículos"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {pageSlice.length > 0 ? (
                <div className={styles.grid}>
                  {pageSlice.map((vehicle) => (
                    <VehicleCard key={vehicle.id} vehicle={vehicle} />
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  <p>Nenhum veículo encontrado com os filtros selecionados.</p>
                  <button type="button" className={styles.clearBtn} onClick={clearFilters}>
                    Limpar filtros
                  </button>
                </div>
              )}

              {totalPages > 1 && (
                <nav className={styles.pagination} aria-label="Paginação">
                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Página anterior"
                  >
                    ←
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.pageBtn} ${n === currentPage ? styles.pageBtnActive : ""}`}
                      onClick={() => setPage(n)}
                      aria-current={n === currentPage ? "page" : undefined}
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Próxima página"
                  >
                    →
                  </button>

                  <span className={styles.pageInfo}>
                    Página {currentPage} de {totalPages}
                  </span>
                </nav>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div className={styles.filterGroup}>
      <h3 className={styles.filterLabel}>{label}</h3>
      {children}
    </div>
  );
}
