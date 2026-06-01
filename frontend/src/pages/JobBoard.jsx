import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Table, TableHead, TableBody,
  TableRow, TableCell, Checkbox, Chip, Avatar, IconButton,
  Select, MenuItem, InputBase, Drawer, Divider,
  CircularProgress, Stack, Grid,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import PersonRemoveAlt1RoundedIcon from '@mui/icons-material/PersonRemoveAlt1Rounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import dayjs from 'dayjs';
import { getJobs, getTechnicians, assignJob, unassignJob, getLocalities, getProductGroups, dashboard, syncGCC } from '../api';
import { C } from '../theme';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';

// ── Helpers ────────────────────────────────────────────────────────────────
const STATUS = {
  'Dispatched': { label: 'Dispatched', bg: C.amberLight,  color: C.amber  },
  'Allocated':  { label: 'Allocated',  bg: C.blueLight,   color: C.blue   },
  'In Service': { label: 'In Service', bg: C.greenLight,  color: C.green  },
  'Completed':  { label: 'Completed',  bg: C.borderLight, color: C.t2 },
  'Rejected':   { label: 'Rejected',   bg: C.redLight,    color: C.red    },
};

// Material Symbols icon names (loaded via Google Fonts in index.html)
const PRODUCT_ICON = {
  'Home Air Conditioner': 'mode_fan',
  'Refrigerator':         'kitchen',
  'Washing Machine':      'local_laundry_service',
  'Drum Washing Machine': 'local_laundry_service',
  'TV':                   'tv',
  'Television':           'tv',
  'Water Heater':         'water_heater',
  'Freezer':              'ac_unit',
  'Cooking':              'cooking',
};

function ProductIcon({ group }) {
  const icon = PRODUCT_ICON[group] || 'build';
  return (
    <span className="material-symbols-outlined" style={{
      fontSize: 20, color: '#525252', lineHeight: 1,
      fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",
    }}>
      {icon}
    </span>
  );
}

const PAGES = 10;

function StatusChip({ status }) {
  const s = STATUS[status] || { label: status, bg: C.borderLight, color: C.t2 };
  return (
    <Chip label={s.label} size="small" sx={{
      bgcolor: s.bg, color: s.color, fontWeight: 700,
      fontSize: '0.7rem', height: 22, border: 'none',
    }} />
  );
}

// ── Top bar ────────────────────────────────────────────────────────────────
function TopBar({ stats, syncing, onSync }) {
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      px: 5, py: 3, bgcolor: '#fff', borderBottom: `1px solid ${C.b1}`,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <Box>
        <Typography variant="h2" sx={{ fontSize: '1.4rem', fontWeight: 700 }}>
          Job Board
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: C.t2, mt: 0.25 }}>
          {dayjs().format('dddd, D MMMM YYYY')}
          {stats?.last_synced && ` · Last sync ${dayjs(stats.last_synced).fromNow()}`}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <Button variant="outlined" sx={{ minWidth: 40, width: 40, height: 40, p: 0, borderColor: C.border }}>
          <NotificationsNoneRoundedIcon sx={{ fontSize: 20, color: C.t2 }} />
        </Button>
        <Button
          variant="contained"
          startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <SyncRoundedIcon sx={{ fontSize: 18 }} />}
          onClick={onSync} disabled={syncing}
          sx={{ height: 40, px: 2.5 }}
        >
          {syncing ? 'Syncing…' : 'Sync from GCC'}
        </Button>
      </Box>
    </Box>
  );
}

// ── Assign panel ───────────────────────────────────────────────────────────
function AssignDrawer({ job, technicians, onAssign, onUnassign, onClose }) {
  const [assigning, setAssigning] = useState(null);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [job.customer_address, job.locality, job.city, 'Visakhapatnam'].filter(Boolean).join(' ')
  )}`;

  const handleAssign = async (techId) => {
    setAssigning(techId);
    await onAssign(job.id, techId);
    setAssigning(null);
  };

  return (
    <Box sx={{ width: 380, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      {/* Header */}
      <Box sx={{ px: 2.5, py: 2, bgcolor: C.sidebar, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{job.work_order_no}</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
            {job.display_type === 'VIP' && (
              <Chip label="VIP" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: C.purple, color: '#fff' }} />
            )}
            {job.is_carry_forward && (
              <Chip label="CARRY FORWARD" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: C.orange, color: '#fff' }} />
            )}
            <StatusChip status={job.status} />
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
        {/* Customer */}
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
          Customer
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.25 }}>{job.customer_name || '—'}</Typography>
        {job.customer_mobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <PhoneOutlinedIcon sx={{ fontSize: 14, color: C.t2 }} />
            <Typography sx={{ fontSize: '0.875rem', color: C.t2 }}>{job.customer_mobile}
              {job.customer_alt_mobile && ` / ${job.customer_alt_mobile}`}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 1 }}>
          <LocationOnOutlinedIcon sx={{ fontSize: 14, color: C.t2, mt: 0.15 }} />
          <Typography sx={{ fontSize: '0.875rem', color: C.t2 }}>
            {[job.customer_address, job.locality, job.city, job.zip_code].filter(Boolean).join(', ') || '—'}
          </Typography>
        </Box>
        <Button size="small" startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
          href={mapsUrl} target="_blank" sx={{ pl: 0, fontSize: '0.8rem', mb: 1.5 }}>
          Open in Google Maps
        </Button>

        <Divider sx={{ mb: 1.5 }} />

        {/* Job details */}
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
          Job Details
        </Typography>
        <Grid container spacing={1.5} mb={1.5}>
          {[
            ['Product', job.product_group || '—'],
            ['Category', job.local_category || '—'],
            ['Model', job.model || '—'],
            ['Repair Type', job.repair_type || '—'],
            ['Complexity', job.productivity_score ? `${job.productivity_score} pts` : '—'],
            ['Distance', job.mileage_km ? `${job.mileage_km} km` : '—'],
            ['Time Slot', job.time_period || '—'],
            ['Source', job.work_order_source || '—'],
          ].map(([l, v]) => (
            <Grid item xs={6} key={l}>
              <Typography sx={{ fontSize: '0.68rem', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>{l}</Typography>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: C.t1 }}>{v}</Typography>
            </Grid>
          ))}
        </Grid>

        {job.customer_description && (
          <>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.75 }}>
              Complaint
            </Typography>
            <Box sx={{ bgcolor: C.bgMuted, borderRadius: 2, p: 1.5, mb: 1.5, maxHeight: 90, overflow: 'auto' }}>
              <Typography sx={{ fontSize: '0.8rem', color: C.t2, lineHeight: 1.6 }}>
                {job.customer_description}
              </Typography>
            </Box>
          </>
        )}

        {/* Current assignment */}
        {(job.assigned_technician_id || job.gcc_assigned_technician) && (
          <Box sx={{ bgcolor: C.greenLight, borderRadius: 2, p: 1.5, mb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '0.68rem', color: '#065F46', fontWeight: 700, mb: 0.25 }}>Assigned to</Typography>
              <Typography sx={{ fontWeight: 700, color: '#065F46' }}>{job.gcc_assigned_technician || 'Technician'}</Typography>
            </Box>
            <Button size="small" color="error" startIcon={<PersonRemoveAlt1RoundedIcon sx={{ fontSize: 14 }} />}
              onClick={() => onUnassign(job.id)} sx={{ fontSize: '0.75rem' }}>
              Remove
            </Button>
          </Box>
        )}

        <Divider sx={{ mb: 1.5 }} />

        {/* Assign */}
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
          Assign Technician
        </Typography>
        {technicians.map(tech => {
          const load = Math.min(100, ((tech.occupied_wo_service_time || 0) / 480) * 100);
          return (
            <Box key={tech.id} onClick={() => handleAssign(tech.id)} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              p: 1.5, border: `1px solid ${C.b1}`, borderRadius: 2, mb: 1,
              cursor: 'pointer', transition: 'all 0.12s',
              '&:hover': { bgcolor: C.blueLight, borderColor: C.blue, },
            }}>
              <Avatar sx={{
                width: 36, height: 36,
                bgcolor: tech.skill_level === 'A' ? C.green : tech.skill_level === 'B' ? C.blue : C.orange,
                fontSize: '0.8rem', fontWeight: 800,
              }}>
                {tech.skill_level || 'T'}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }} noWrap>{tech.name}</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: C.t2 }}>
                  {tech.type} · {tech.occupied_wo_service_time || 0}h occupied
                </Typography>
              </Box>
              {assigning === tech.id
                ? <CircularProgress size={18} />
                : <PersonAddAlt1RoundedIcon sx={{ fontSize: 18, color: C.blue }} />
              }
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function JobBoard() {
  const [jobs,       setJobs]       = useState([]);
  const [techs,      setTechs]      = useState([]);
  const [localities, setLocalities] = useState([]);
  const [products,   setProducts]   = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [syncing,    setSyncing]    = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checked,    setChecked]    = useState([]);
  const [page,       setPage]       = useState(1);
  const [totalJobs,  setTotalJobs]  = useState(0);

  const [filters, setFilters] = useState({
    search: '', status: '', priority: '', locality: '', product_group: '', assigned: '',
  });
  const setF = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

  const load = useCallback(async () => {
    setLoading(true);
    const params = { page, limit: PAGES };
    if (filters.search)        params.search        = filters.search;
    if (filters.status)        params.status        = filters.status;
    if (filters.priority)      params.priority      = filters.priority;
    if (filters.locality)      params.locality      = filters.locality;
    if (filters.product_group) params.product_group = filters.product_group;
    if (filters.assigned !== '') params.assigned    = filters.assigned === 'yes';

    const [j, t, l, pg, d] = await Promise.all([
      getJobs(params),
      getTechnicians({ status: 'Active' }),
      getLocalities(),
      getProductGroups(),
      dashboard(),
    ]);
    setJobs(j);
    setTechs(t);
    setLocalities(l);
    setProducts(pg);
    setStats(d);
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh from DB every 5 min
  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const doSync = async () => {
    setMsg && setMsg('Run sync_gcc.bat on the office PC to sync from GCC.');
    await load(); // refresh from DB
  };

  const handleAssign = async (jobId, techId) => {
    await assignJob({ job_id: jobId, technician_id: techId });
    setDrawerOpen(false);
    await load();
  };

  const handleUnassign = async (jobId) => {
    await unassignJob(jobId);
    await load();
  };

  const openDrawer = (job) => { setSelected(job); setDrawerOpen(true); };

  const toggleCheck = (id) =>
    setChecked(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  const allChecked = jobs.length > 0 && checked.length === jobs.length;
  const toggleAll = () => setChecked(allChecked ? [] : jobs.map(j => j.id));

  const totalPages = Math.ceil((stats?.total_open || 0) / PAGES);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: C.bgPage }}>
      <TopBar stats={stats} syncing={syncing} onSync={doSync} />

      <Box sx={{ px: 5, py: 4 }}>
        {/* ── Stat row — flat, no icons, same as Dashboard ── */}
        <Box sx={{ bgcolor: C.white, border: `1px solid ${C.b1}`, display: 'flex', mb: 4 }}>
          {[
            { label: 'Total Open Jobs',  value: stats?.total_open,    sub: stats?.total_active != null ? `${stats.total_active} active` : null, subColor: C.t3, note: 'All work orders in system', br: true },
            { label: 'Pending Accept',   value: stats?.pending_accept, sub: (stats?.pending_accept||0)>0 ? 'Needs action' : 'Clear', subColor: (stats?.pending_accept||0)>0 ? C.red : C.green, note: 'Awaiting SC acknowledgement', br: true },
            { label: 'Unassigned Jobs',  value: stats?.unassigned,     sub: 'No technician', subColor: C.amber, note: 'Active jobs without tech', br: true },
            { label: 'VIP Jobs Open',    value: stats?.vip_open,       sub: 'Priority',      subColor: C.purple, note: 'VIP customer jobs', br: false },
          ].map((s, i) => (
            <Box key={i} sx={{ flex: 1, px: 4, py: 3.5, borderRight: s.br ? `1px solid ${C.b1}` : 'none' }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: C.t3,
                textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                {s.label}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mb: 0.5 }}>
                <Typography sx={{ fontSize: '2.5rem', fontWeight: 800, color: C.t1, lineHeight: 1 }}>
                  {s.value ?? '—'}
                </Typography>
                {s.sub && (
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: s.subColor }}>
                    {s.sub}
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: '0.72rem', color: C.t3 }}>{s.note}</Typography>
            </Box>
          ))}
        </Box>

        {/* ── Toolbar ── */}
        <Card sx={{ mb: 0, borderBottom: 'none' }}>
          <Box sx={{
            px: 3, py: 1.5, display: 'flex', alignItems: 'center',
            gap: 1.5, flexWrap: 'wrap', borderBottom: `1px solid ${C.b1}`,
          }}>
            {/* Table view button */}
            <Button variant="outlined" size="small" sx={{ height: 36, borderColor: C.b1, color: C.t1, gap: 0.5 }}>
              <Box sx={{ width: 14, height: 14, border: `2px solid ${C.textSecondary}`, borderRadius: 0.5 }} />
              Table View
            </Button>

            <Button variant="outlined" size="small" startIcon={<FilterAltOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ height: 36, borderColor: C.b1, color: C.t1 }}>
              Filter
            </Button>

            <Button variant="outlined" size="small" startIcon={<SwapVertRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{ height: 36, borderColor: C.b1, color: C.t1 }}>
              Sort
            </Button>

            {/* Search */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.75,
              border: `1px solid ${C.b1}`, borderRadius: 2, px: 1.5, height: 36, flex: 1, minWidth: 200,
            }}>
              <SearchRoundedIcon sx={{ fontSize: 16, color: C.textMuted }} />
              <InputBase
                placeholder="Search WO#, customer, locality…"
                value={filters.search}
                onChange={e => setF('search', e.target.value)}
                sx={{ flex: 1, fontSize: '0.875rem' }}
              />
            </Box>

            {/* Filters */}
            {[
              { label: 'Status',   key: 'status',   opts: ['Dispatched','Allocated','In Service','Rejected'] },
              { label: 'Priority', key: 'priority', opts: ['VIP','Normal'] },
              { label: 'Product',  key: 'product_group', opts: products },
              { label: 'Locality', key: 'locality',  opts: localities.slice(0,15) },
              { label: 'Assigned', key: 'assigned',  opts: [['yes','Assigned'],['no','Unassigned']] },
            ].map(f => (
              <Select key={f.key} value={filters[f.key]} displayEmpty
                onChange={e => setF(f.key, e.target.value)}
                size="small" variant="outlined"
                sx={{ height: 36, fontSize: '0.875rem', minWidth: 110, borderColor: C.b1,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: C.b1 },
                }}>
                <MenuItem value="">{f.label}</MenuItem>
                {f.opts.map(o => Array.isArray(o)
                  ? <MenuItem key={o[0]} value={o[0]}>{o[1]}</MenuItem>
                  : <MenuItem key={o} value={o}>{o}</MenuItem>
                )}
              </Select>
            ))}

            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" startIcon={<TuneRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{ height: 36, borderColor: C.b1, color: C.t1 }}>
                Customize
              </Button>
              <Button variant="contained" size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{ height: 36 }}>
                + Add New Job
              </Button>
            </Box>
          </Box>
        </Card>

        {/* ── Table ── */}
        <Card sx={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ pl: 2 }}>
                    <Checkbox size="small" checked={allChecked} indeterminate={checked.length > 0 && !allChecked} onChange={toggleAll} />
                  </TableCell>
                  {['Job Details','Customer','Product','Status','Date / Time','Assigned'].map(h => (
                    <TableCell key={h}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} />
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">No jobs found — adjust filters or sync from GCC</Typography>
                    </TableCell>
                  </TableRow>
                ) : jobs.map(job => (
                  <TableRow
                    key={job.id}
                    selected={checked.includes(job.id)}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openDrawer(job)}
                  >
                    <TableCell padding="checkbox" sx={{ pl: 2 }} onClick={e => { e.stopPropagation(); toggleCheck(job.id); }}>
                      <Checkbox size="small" checked={checked.includes(job.id)} />
                    </TableCell>

                    {/* Job Details */}
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                        {job.display_type === 'VIP' && (
                          <Chip label="VIP" size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, bgcolor: C.sidebar, color: '#fff' }} />
                        )}
                        {job.is_carry_forward && (
                          <Chip label="CARRY FORWARD" size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: C.redLight, color: C.red }} />
                        )}
                      </Box>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', color: C.blue, fontFamily: 'monospace' }}>
                        {job.work_order_no}
                      </Typography>
                    </TableCell>

                    {/* Customer */}
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{job.customer_name || '—'}</Typography>
                      {(job.locality || job.city) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <LocationOnOutlinedIcon sx={{ fontSize: 12, color: C.textMuted }} />
                          <Typography sx={{ fontSize: '0.75rem', color: C.t2 }}>
                            {job.locality || job.city}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>

                    {/* Product */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ProductIcon group={job.product_group} />
                        <Box>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{job.product_group || '—'}</Typography>
                          {job.local_category && (
                            <Typography sx={{ fontSize: '0.72rem', color: C.t2 }}>{job.local_category}</Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Status */}
                    <TableCell><StatusChip status={job.status} /></TableCell>

                    {/* Date/Time */}
                    <TableCell>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        {job.gcc_created_at ? dayjs(job.gcc_created_at).format('D MMM') : '—'}
                      </Typography>
                      {job.gcc_created_at && (
                        <Typography sx={{ fontSize: '0.72rem', color: C.t2 }}>
                          {dayjs(job.gcc_created_at).format('HH:mm')}
                        </Typography>
                      )}
                    </TableCell>

                    {/* Assigned */}
                    <TableCell>
                      {(job.assigned_technician_id || job.gcc_assigned_technician) ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 26, height: 26, bgcolor: C.blue, fontSize: '0.7rem', fontWeight: 700 }}>
                            {(job.gcc_assigned_technician || 'T')[0]}
                          </Avatar>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }} noWrap>
                            {(job.gcc_assigned_technician || 'Assigned').split(' ')[0]}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: '0.8rem', color: C.textMuted, fontStyle: 'italic' }}>Unassigned</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          {/* Pagination */}
          <Box sx={{
            px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', borderTop: `1px solid ${C.border}`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.875rem', color: C.t2 }}>Showing per page</Typography>
              <Select value={10} size="small" sx={{ height: 30, fontSize: '0.875rem', '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
              </Select>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton size="small" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                <NavigateBeforeRoundedIcon fontSize="small" />
              </IconButton>
              {[...Array(Math.min(5, totalPages || 1))].map((_, i) => {
                const p = i + 1;
                return (
                  <Box key={p} onClick={() => setPage(p)} sx={{
                    width: 30, height: 30, borderRadius: 1.5, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    bgcolor: page === p ? C.blue : 'transparent',
                    color: page === p ? '#fff' : C.textSecondary,
                    fontWeight: page === p ? 700 : 400, fontSize: '0.875rem',
                    '&:hover': { bgcolor: page === p ? C.blue : C.bgMuted },
                  }}>
                    {p}
                  </Box>
                );
              })}
              {totalPages > 5 && <Typography sx={{ color: C.textMuted, fontSize: '0.875rem' }}>…</Typography>}
              {totalPages > 5 && (
                <Box onClick={() => setPage(totalPages)} sx={{
                  width: 30, height: 30, borderRadius: 1.5, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  color: C.t2, fontSize: '0.875rem',
                  '&:hover': { bgcolor: C.bgMuted },
                }}>
                  {totalPages}
                </Box>
              )}
              <IconButton size="small" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                <NavigateNextRoundedIcon fontSize="small" />
              </IconButton>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 1 }}>
                <Typography sx={{ fontSize: '0.875rem', color: C.t2 }}>Go to page</Typography>
                <InputBase
                  type="number"
                  defaultValue={page}
                  onBlur={e => setPage(Math.min(totalPages, Math.max(1, Number(e.target.value))))}
                  sx={{
                    width: 48, height: 30, border: `1px solid ${C.b1}`, borderRadius: 1.5,
                    px: 1, fontSize: '0.875rem', textAlign: 'center',
                  }}
                />
                <Button variant="outlined" size="small" sx={{ height: 30, minWidth: 0, px: 1.5, fontSize: '0.8rem', borderColor: C.border }}>
                  GO →
                </Button>
              </Box>
            </Box>
          </Box>
        </Card>

        {/* Bulk action bar */}
        {checked.length > 0 && (
          <Box sx={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            bgcolor: C.sidebar, borderRadius: 3, px: 2.5, py: 1.5,
            display: 'flex', alignItems: 'center', gap: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)', zIndex: 200,
          }}>
            <Chip label={`${checked.length} Selected`} size="small"
              sx={{ bgcolor: C.blue, color: '#fff', fontWeight: 700 }} />
            <Button size="small" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>
              Apply Code
            </Button>
            <Button size="small" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>
              Edit Info
            </Button>
            <Button size="small" sx={{ color: C.red, fontSize: '0.8rem' }}>
              Delete
            </Button>
            <IconButton size="small" onClick={() => setChecked([])} sx={{ color: 'rgba(255,255,255,0.6)' }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Assign Drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        sx={{ '& .MuiDrawer-paper': { borderRadius: 0 } }}>
        {selected && (
          <AssignDrawer
            job={selected}
            technicians={techs}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </Drawer>
    </Box>
  );
}
