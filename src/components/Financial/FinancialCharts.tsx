import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency } from "../../lib/utils";

interface ChartDataPoint {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

interface CategoryData {
  name: string;
  value: number;
  percentage: number;
  [key: string]: string | number;
}

interface FinancialChartsProps {
  monthlyData: ChartDataPoint[];
  categoryData: CategoryData[];
  chartType: "bar" | "line";
}

const COLORS = {
  receitas: "#10b981", // emerald-500
  despesas: "#f43f5e", // rose-500
  saldo: "#6366f1", // indigo-500
};

const CATEGORY_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
  "#64748b", // slate
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 mb-1"
          >
            <span
              className="text-sm text-gray-600"
              style={{ color: entry.color }}
            >
              {entry.name}:
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: entry.color }}
            >
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-1">{data.name}</p>
        <p className="text-sm text-gray-600">
          Valor:{" "}
          <span className="font-semibold">{formatCurrency(data.value)}</span>
        </p>
        <p className="text-sm text-gray-600">
          Percentual:{" "}
          <span className="font-semibold">
            {data.payload.percentage.toFixed(1)}%
          </span>
        </p>
      </div>
    );
  }
  return null;
};

export const RevenueExpenseChart: React.FC<{
  data: ChartDataPoint[];
  chartType: "bar" | "line";
}> = ({ data, chartType }) => {
  const Chart = chartType === "bar" ? BarChart : LineChart;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-4">
        Receitas x Despesas
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <Chart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            stroke="#64748b"
            style={{ fontSize: "12px" }}
          />
          <YAxis
            stroke="#64748b"
            style={{ fontSize: "12px" }}
            tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "14px", paddingTop: "20px" }}
            iconType="circle"
          />

          {chartType === "bar" ? (
            <>
              <Bar
                dataKey="receitas"
                name="Receitas"
                fill={COLORS.receitas}
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="despesas"
                name="Despesas"
                fill={COLORS.despesas}
                radius={[8, 8, 0, 0]}
              />
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="receitas"
                name="Receitas"
                stroke={COLORS.receitas}
                strokeWidth={3}
                dot={{ r: 5 }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="despesas"
                name="Despesas"
                stroke={COLORS.despesas}
                strokeWidth={3}
                dot={{ r: 5 }}
                activeDot={{ r: 7 }}
              />
            </>
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
};

export const CategoryPieChart: React.FC<{ data: CategoryData[] }> = ({
  data,
}) => {
  // Pegar top 8 categorias + agrupar resto
  const topCategories = data.slice(0, 8);
  const others = data.slice(8);

  const chartData = [...topCategories];
  if (others.length > 0) {
    const othersTotal = others.reduce((sum, cat) => sum + cat.value, 0);
    const othersPercentage = others.reduce(
      (sum, cat) => sum + cat.percentage,
      0,
    );
    chartData.push({
      name: "Outras",
      value: othersTotal,
      percentage: othersPercentage,
    });
  }

  const renderCustomLabel = (entry: any) => {
    return `${entry.percentage.toFixed(0)}%`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-4">
        Distribuição por Categoria
      </h3>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[350px] text-gray-500">
          Nenhuma categoria com despesas no período
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Gráfico */}
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda */}
          <div className="flex-1 w-full">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {chartData.map((category, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                      }}
                    />
                    <span className="text-sm text-gray-700 font-medium">
                      {category.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(category.value)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {category.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const FinancialCharts: React.FC<FinancialChartsProps> = ({
  monthlyData,
  categoryData,
  chartType,
}) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <RevenueExpenseChart data={monthlyData} chartType={chartType} />
      <CategoryPieChart data={categoryData} />
    </div>
  );
};
