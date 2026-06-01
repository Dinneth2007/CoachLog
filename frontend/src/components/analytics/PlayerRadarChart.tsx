import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { DIMENSION_LABELS } from '../../api/sessions';
import type { Dimension } from '../../api/sessions';
import type { RadarPoint } from '../../utils/scoreAnalytics';

interface Props {
  points: RadarPoint[];
  missingInLatest: Dimension[];
}

export default function PlayerRadarChart({ points, missingInLatest }: Props) {
  if (points.length === 0) return null;

  return (
    <div>
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#475569' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 5]}
              tickCount={6}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [`${value.toFixed(1)} / 5`, name === 'current' ? 'Latest' : 'Historical avg']}
            />
            <Radar
              dataKey="average"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              fill="#cbd5e1"
              fillOpacity={0.2}
              isAnimationActive={false}
            />
            <Radar
              dataKey="current"
              stroke="#059669"
              strokeWidth={2}
              fill="#10b981"
              fillOpacity={0.35}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/60 border border-emerald-600" />
          Latest session
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-300/40 border border-slate-400 border-dashed" />
          Historical avg
        </span>
      </div>
      {missingInLatest.length > 0 && (
        <p className="mt-2 text-xs text-slate-500 italic text-center">
          Not scored in latest session: {missingInLatest.map((d) => DIMENSION_LABELS[d]).join(', ')}
        </p>
      )}
    </div>
  );
}
