import React, { useState } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";

interface PeriodSelectorProps {
  selectedPeriods: string[];
  onPeriodsChange: (periods: string[]) => void;
  availableYears?: number[];
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriods,
  onPeriodsChange,
  availableYears = [2024, 2025, 2026],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const monthsShort = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  const togglePeriod = (period: string) => {
    if (selectedPeriods.includes(period)) {
      onPeriodsChange(selectedPeriods.filter((p) => p !== period));
    } else {
      onPeriodsChange([...selectedPeriods, period].sort());
    }
  };

  const selectPreset = (
    preset: "bimestral" | "trimestral" | "semestral" | "anual",
  ) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let periods: string[] = [];

    switch (preset) {
      case "bimestral":
        // Últimos 2 meses
        for (let i = 1; i >= 0; i--) {
          const date = new Date(currentYear, currentMonth - i, 1);
          periods.push(
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
          );
        }
        break;
      case "trimestral":
        // Últimos 3 meses
        for (let i = 2; i >= 0; i--) {
          const date = new Date(currentYear, currentMonth - i, 1);
          periods.push(
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
          );
        }
        break;
      case "semestral":
        // Últimos 6 meses
        for (let i = 5; i >= 0; i--) {
          const date = new Date(currentYear, currentMonth - i, 1);
          periods.push(
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
          );
        }
        break;
      case "anual":
        // Ano inteiro atual
        for (let i = 0; i < 12; i++) {
          periods.push(`${currentYear}-${String(i + 1).padStart(2, "0")}`);
        }
        break;
    }

    onPeriodsChange(periods);
    setIsOpen(false);
  };

  const clearSelection = () => {
    onPeriodsChange([]);
  };

  const formatSelectedPeriods = () => {
    if (selectedPeriods.length === 0) return "Selecione períodos";
    if (selectedPeriods.length === 1) {
      const [year, month] = selectedPeriods[0].split("-");
      return `${monthsShort[parseInt(month) - 1]}/${year}`;
    }
    if (
      selectedPeriods.length === 12 &&
      selectedPeriods.every((p) => p.startsWith(selectedYear.toString()))
    ) {
      return `Ano ${selectedYear}`;
    }
    return `${selectedPeriods.length} meses selecionados`;
  };

  return (
    <div className="relative">
      {/* Botão Principal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-w-[200px] justify-between"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>{formatSelectedPeriods()}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay para fechar ao clicar fora */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 min-w-[400px] max-h-[600px] overflow-hidden">
            {/* Header com ações rápidas */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">
                  Selecionar Períodos
                </h3>
                {selectedPeriods.length > 0 && (
                  <button
                    onClick={clearSelection}
                    className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Limpar
                  </button>
                )}
              </div>

              {/* Presets */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => selectPreset("bimestral")}
                  className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                >
                  Bimestral
                </button>
                <button
                  onClick={() => selectPreset("trimestral")}
                  className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                >
                  Trimestral
                </button>
                <button
                  onClick={() => selectPreset("semestral")}
                  className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                >
                  Semestral
                </button>
                <button
                  onClick={() => selectPreset("anual")}
                  className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                >
                  Anual
                </button>
              </div>
            </div>

            {/* Seletor de Ano */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                {availableYears.map((year) => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      selectedYear === year
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendário de Meses */}
            <div className="p-4 overflow-y-auto max-h-[400px]">
              <div className="grid grid-cols-3 gap-3">
                {months.map((month, index) => {
                  const period = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
                  const isSelected = selectedPeriods.includes(period);

                  return (
                    <button
                      key={period}
                      onClick={() => togglePeriod(period)}
                      className={`p-3 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-md"
                          : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-bold">{month}</div>
                        <div
                          className={`text-xs mt-1 ${isSelected ? "text-indigo-100" : "text-gray-500"}`}
                        >
                          {selectedYear}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer com resumo */}
            {selectedPeriods.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-indigo-600">
                    {selectedPeriods.length}
                  </span>{" "}
                  mês{selectedPeriods.length !== 1 ? "es" : ""} selecionado
                  {selectedPeriods.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
