import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DIMENSION_LABELS } from '../../api/sessions';
import type { Category, Dimension } from '../../api/sessions';
import type { CategorySessionRow } from '../../utils/scoreAnalytics';

const PALETTE = ['#334155', '#0284c7', '#059669', '#d97706', '#e11d48'];

interface Props {
  category: Category;
  data: CategorySessionRow[];
  dimensions: readonly Dimension[];
}

export default function DimensionTrendChart({ data, dimensions }: Props) {
  if (dimensions.length === 0 || data.length < 2) return null;

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="dateLabel"
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            tickMargin={6}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            stroke="#64748b"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
            labelStyle={{ color: '#0f172a', fontWeight: 500 }}
            formatter={(value: number, name: string) => [`${value} / 5`, DIMENSION_LABELS[name as Dimension] ?? name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
            formatter={(value: string) => DIMENSION_LABELS[value as Dimension] ?? value}
          />
          {dimensions.map((dim, i) => (
            <Line
              key={dim}
              type="monotone"
              dataKey={dim}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
