import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORY_HEX, CATEGORY_LABELS } from '../../api/sessions';
import type { Category } from '../../api/sessions';
import type { CategoryAverageRow } from '../../utils/scoreAnalytics';

const CATEGORY_COLORS = CATEGORY_HEX;

interface Props {
  data: CategoryAverageRow[];
  categoriesPresent: Category[];
}

export default function CategoryAveragesChart({ data, categoriesPresent }: Props) {
  if (data.length < 2 || categoriesPresent.length === 0) return null;

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <defs>
            {categoriesPresent.map((cat) => (
              <linearGradient key={cat} id={`grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CATEGORY_COLORS[cat]} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CATEGORY_COLORS[cat]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="dateLabel"
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            tickMargin={6}
          />
          <YAxis
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
            stroke="#64748b"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
            formatter={(value, name) => [
              `${Number(value).toFixed(1)} / 5`,
              CATEGORY_LABELS[String(name) as Category] ?? String(name),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
            formatter={(value: string) => CATEGORY_LABELS[value as Category] ?? value}
          />
          {categoriesPresent.map((cat) => (
            <Area
              key={cat}
              type="monotone"
              dataKey={cat}
              stroke={CATEGORY_COLORS[cat]}
              strokeWidth={2}
              fill={`url(#grad-${cat})`}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
