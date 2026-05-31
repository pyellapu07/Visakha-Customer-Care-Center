import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Divider, LinearProgress, CircularProgress,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { dashboard, syncGCC, syncLogs } from '../api';
import { C } from '../theme';

dayjs.extend(relativeTime);

const DB_REFRESH_MS = 5  * 60 * 1000;
const GCC_SYNC_MS   = 45 * 60 * 1000;
const ADMIN_NAME    = 'Trinadha';

// Pure CSS bar chart — always renders, no ResizeObserver needed
function CSSBarChart({ data, small }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.v || 0), 1);
  const h = small ? 80 : 180;

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: h, pt: 1 }}>
      {data.map((d, i) => (
        <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, height: '100%', justifyContent: 'flex-end' }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: C.t2 }}>
            {d.v > 0 ? d.v : ''}
          </Typography>
          <Box
            sx={{
              width: '100%', bgcolor: d.c || C.b1,
              height: `${Math.max(2, (d.v / max) * (h - 40))}px`,
              transition: 'height 0.4s ease',
              minHeight: d.v > 0 ? 4 : 2,
            }}
          />
          <Typography sx={{ fontSize: '0.68rem', color: C.t3, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
            {d.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Flat stat block — no card border, just a box
function StatBlock({ label, value, sub, subColor, note, borderRight }) {
  return (
    <Box sx={{
      flex: 1, px: 5, py: 4,
      borderRight: borderRight ? `1px solid ${C.b1}` : 'none',
    }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: C.t3,
        textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.5 }}>
        <Typography sx={{ fontSize: '2.75rem', fontWeight: 800, color: C.t1, lineHeight: 1 }}>
          {value ?? '—'}
        </Typography>
        {sub && (
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: subColor }}>
            {sub}
          </Typography>
        )}
      </Box>
      {note && (
        <Typography sx={{ fontSize: '0.75rem', color: C.t3, mt: 0.25 }}>{note}</Typography>
      )}
    </Box>
  );
}

// Minimal action row
function ActionRow({ dot, label, tag, tagColor, last }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      py: 1.75, borderBottom: last ? 'none' : `1px solid ${C.b1}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dot, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.875rem', color: C.t1 }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: tagColor,
        textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {tag}
      </Typography>
    </Box>
  );
}

export default function Dashboard() {
  const [stats,   setStats]   = useState(null);
  const [logs,    setLogs]    = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [msg,     setMsg]     = useState(null);
  const [nextIn,  setNextIn]  = useState(GCC_SYNC_MS / 1000);
  const lastSyncRef = useRef(Date.now());

  const loadStats = useCallback(async () => {
    try {
      const [d, l] = await Promise.all([dashboard(), syncLogs()]);
      setStats(d);
      setLogs(l);
    } catch (_) {}
  }, []);

  const doSync = useCallback(async (auto = false) => {
    if (syncing) return;
    setSyncing(true);
    setMsg(null);
    try {
      const r = await syncGCC();
      setMsg(r.status === 'success'
        ? `Synced ${r.jobs_fetched} jobs · ${r.jobs_new} new${auto ? ' (auto)' : ''}`
        : `Error: ${r.error}`);
      lastSyncRef.current = Date.now();
      setNextIn(GCC_SYNC_MS / 1000);
      await loadStats();
    } catch (e) {
      setMsg(`Failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }, [syncing, loadStats]);

  useEffect(() => { loadStats(); const t = setInterval(loadStats, DB_REFRESH_MS); return () => clearInterval(t); }, [loadStats]);

  useEffect(() => {
    const t = setInterval(() => {
      const elapsed = (Date.now() - lastSyncRef.current) / 1000;
      const rem = Math.max(0, GCC_SYNC_MS / 1000 - elapsed);
      setNextIn(rem);
      if (rem <= 0) doSync(true);
    }, 15000);
    return () => clearInterval(t);
  }, [doSync]);

  const chartData = stats ? [
    { name: 'Pending',   v: stats.pending_assign,  c: C.blue },
    { name: 'Carry Fwd', v: stats.carry_forward,   c: C.red },
    { name: 'VIP',       v: stats.vip_open,         c: C.purple },
    { name: 'Done',      v: stats.completed_today,  c: C.green },
  ] : [];

  const weekData = [
    { name: 'Mon', v: 18, c: C.b2 },
    { name: 'Tue', v: 24, c: C.b2 },
    { name: 'Wed', v: 31, c: C.b2 },
    { name: 'Thu', v: 22, c: C.b2 },
    { name: 'Fri', v: 28, c: C.b2 },
    { name: 'Sat', v: 15, c: C.b2 },
    { name: 'Today', v: stats?.completed_today || 0, c: C.blue },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: C.bgPage }}>

      {/* ── Top bar ── */}
      <Box sx={{
        px: 5, py: 3, bgcolor: C.white,
        borderBottom: `1px solid ${C.b1}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Box>
          <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: C.t1, lineHeight: 1 }}>
            {greeting()}, {ADMIN_NAME} 👋
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: C.t3, mt: 0.75 }}>
            {dayjs().format('dddd, D MMMM YYYY')}
            {stats?.last_synced && ` · Last sync ${dayjs(stats.last_synced).fromNow()}`}
            {nextIn > 0 && (
              <span style={{ color: C.blue, marginLeft: 8, fontWeight: 600 }}>
                · Auto-sync in {Math.ceil(nextIn / 60)}m
              </span>
            )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          disableElevation
          startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon sx={{ fontSize: 16 }} />}
          onClick={() => doSync(false)}
          disabled={syncing}
          sx={{ height: 40, px: 2.5 }}
        >
          {syncing ? 'Syncing…' : 'Sync from GCC'}
        </Button>
      </Box>

      {/* ── Sync message ── */}
      {msg && (
        <Box sx={{
          px: 5, py: 1.5,
          bgcolor: msg.startsWith('Error') || msg.startsWith('Failed') ? C.redDim : C.greenDim,
          borderBottom: `1px solid ${C.b1}`,
        }}>
          <Typography sx={{ fontSize: '0.875rem', color: msg.startsWith('Error') || msg.startsWith('Failed') ? C.red : C.green, fontWeight: 500 }}>
            {msg}
          </Typography>
        </Box>
      )}

      <Box sx={{ px: 5, py: 4 }}>

        {/* ── Stat row — full bleed card with internal dividers ── */}
        <Box sx={{
          bgcolor: C.white, border: `1px solid ${C.b1}`,
          display: 'flex', mb: 4,
        }}>
          <StatBlock
            label="Total Jobs"
            value={stats?.total_open}
            sub={stats?.total_active != null ? `${stats.total_active} active` : null}
            subColor={C.t3}
            note="All work orders in system"
            borderRight
          />
          <StatBlock
            label="Pending Accept"
            value={stats?.pending_accept}
            sub={(stats?.pending_accept ?? 0) > 0 ? 'Needs action' : 'Clear'}
            subColor={(stats?.pending_accept ?? 0) > 0 ? C.red : C.green}
            note="Awaiting SC acknowledgement"
            borderRight
          />
          <StatBlock
            label="Unassigned"
            value={stats?.unassigned}
            sub="No technician"
            subColor={C.amber}
            note="Active jobs without tech"
            borderRight
          />
          <StatBlock
            label="VIP Open"
            value={stats?.vip_open}
            sub="Priority"
            subColor={C.purple}
            note="VIP customer jobs"
            borderRight
          />
          <StatBlock
            label="Completed Today"
            value={stats?.completed_today}
            sub={stats?.carry_forward ? `${stats.carry_forward} carried fwd` : null}
            subColor={C.amber}
            note="Closed since midnight"
          />
        </Box>

        {/* ── Charts + Actions — two columns ── */}
        <Box sx={{ display: 'flex', gap: 4 }}>

          {/* Left: charts — minWidth:0 is required for recharts inside flex */}
          <Box sx={{ flex: 1.4, minWidth: 0, bgcolor: C.white, border: `1px solid ${C.b1}`, p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: C.t1 }}>
                Today's Snapshot
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: C.green,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Live
              </Typography>
            </Box>

            {/* CSS bar chart — no recharts needed */}
            <CSSBarChart data={chartData} />

            <Divider sx={{ my: 3 }} />

            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: C.t1, mb: 2.5 }}>
              Week at a glance
            </Typography>
            <CSSBarChart data={weekData} small />
          </Box>

          {/* Right: action items + sync log */}
          <Box sx={{ flex: 1, minWidth: 0, bgcolor: C.white, border: `1px solid ${C.b1}`, p: 4, display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: C.t1, mb: 0.5 }}>
              Action Items
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: C.t3, mb: 2.5 }}>
              Things that need attention right now
            </Typography>

            <ActionRow dot={C.red}   label={`${stats?.pending_accept ?? '—'} jobs need acceptance`}      tag="High Priority" tagColor={C.red} />
            <ActionRow dot={C.amber} label={`${stats?.carry_forward ?? '—'} jobs carried forward`}        tag="Delayed"       tagColor={C.amber} />
            <ActionRow dot={C.t3}    label={`${stats?.unassigned ?? '—'} jobs without a technician`}      tag="Assign now"    tagColor={C.blue} />
            <ActionRow dot={C.green} label={`${stats?.pending_parts ?? '—'} part requests pending`}       tag={stats?.pending_parts === 0 ? 'Clear' : 'Action needed'} tagColor={stats?.pending_parts === 0 ? C.green : C.amber} />
            <ActionRow dot={C.purple} label={`${stats?.vip_open ?? '—'} VIP customers waiting`}           tag="Priority"      tagColor={C.purple} last />

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: C.t1 }}>Recent Syncs</Typography>
            </Box>

            {logs.length === 0 ? (
              <Typography sx={{ fontSize: '0.8rem', color: C.t3 }}>
                No syncs yet — click Sync from GCC
              </Typography>
            ) : logs.slice(0, 5).map((log, i) => (
              <Box key={i} sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                py: 1.25, borderBottom: i < 4 ? `1px solid ${C.b1}` : 'none',
              }}>
                <Typography sx={{ fontSize: '0.8rem', color: C.t2 }}>
                  {dayjs(log.synced_at).format('D MMM · HH:mm')}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600,
                  color: log.status === 'success' ? C.green : C.red }}>
                  {log.status === 'success' ? `+${log.jobs_new} · ${log.jobs_fetched} total` : 'Error'}
                </Typography>
              </Box>
            ))}

            <Box sx={{ mt: 'auto', pt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography sx={{ fontSize: '0.75rem', color: C.t3 }}>Auto-sync progress</Typography>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: C.blue }}>
                  {Math.ceil(nextIn / 60)}m
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.max(0, 100 - (nextIn / (GCC_SYNC_MS / 1000)) * 100)}
                sx={{
                  height: 3, borderRadius: 0,
                  bgcolor: C.b1,
                  '& .MuiLinearProgress-bar': { bgcolor: C.blue, borderRadius: 0 },
                }}
              />
              <Typography sx={{ fontSize: '0.7rem', color: C.t3, mt: 1 }}>
                DB refreshes every 5 min · GCC sync every 45 min
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
