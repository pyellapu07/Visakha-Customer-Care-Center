import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, LinearProgress, Divider, Grid, Button, Avatar,
} from '@mui/material';
import { getTechnicians, getTechJobs } from '../api';
import { C } from '../theme';
import dayjs from 'dayjs';

const GRADE = {
  A: { color: C.green,  bg: C.greenDim,  label: 'Grade A' },
  B: { color: C.blue,   bg: C.blueDim,   label: 'Grade B' },
  C: { color: C.amber,  bg: C.amberDim,  label: 'Grade C' },
};

const STATUS_COLOR = {
  'Allocated': C.blue, 'In Service': C.green,
  'Dispatched': C.amber, 'Completed': C.t3,
};

function GradeChip({ grade }) {
  const g = GRADE[grade] || { color: C.t3, bg: C.bgMuted, label: `Grade ${grade || '?'}` };
  return (
    <Chip label={g.label} size="small"
      sx={{ bgcolor: g.bg, color: g.color, fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
  );
}

function WorkloadBar({ hours }) {
  const pct = Math.min(100, ((hours || 0) / 480) * 100);
  const color = pct > 80 ? C.red : pct > 60 ? C.amber : C.green;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <LinearProgress variant="determinate" value={pct} sx={{
        flex: 1, height: 4, borderRadius: 0, bgcolor: C.b1,
        '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 0 },
      }} />
      <Typography sx={{ fontSize: '0.72rem', color: C.t3, whiteSpace: 'nowrap', minWidth: 32 }}>
        {hours || 0}h
      </Typography>
    </Box>
  );
}

export default function Technicians() {
  const [techs,    setTechs]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [techJobs, setTechJobs] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    getTechnicians({ status: 'Active' }).then(t => { setTechs(t); setLoading(false); });
  }, []);

  const selectTech = async (tech) => {
    if (selected?.id === tech.id) { setSelected(null); return; }
    setSelected(tech);
    const jobs = await getTechJobs(tech.id);
    setTechJobs(jobs);
  };

  const sections = [
    { label: 'Full-Time Engineers', items: techs.filter(t => t.type === 'Full-Time') },
    { label: 'Seasonal Engineers',  items: techs.filter(t => t.type === 'Seasonal') },
    { label: 'Freelancers',         items: techs.filter(t => t.type === 'Freelancer') },
  ].filter(s => s.items.length > 0);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: C.bgPage }}>

      {/* Main */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <Box sx={{
          px: 5, py: 3, bgcolor: C.white, borderBottom: `1px solid ${C.b1}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', color: C.t1 }}>Technicians</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: C.t3, mt: 0.25 }}>
              {techs.length} active · {techs.filter(t => t.type === 'Full-Time').length} full-time · {techs.filter(t => t.type === 'Seasonal').length} seasonal
            </Typography>
          </Box>
          <Button variant="contained" disableElevation sx={{ height: 38 }}>
            + Add Technician
          </Button>
        </Box>

        <Box sx={{ p: 5 }}>
          {loading ? <LinearProgress sx={{ borderRadius: 0 }} /> : sections.map(({ label, items }) => (
            <Box key={label} sx={{ mb: 5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', color: C.t3,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: C.t3 }}>— {items.length}</Typography>
              </Box>

              <Box sx={{ bgcolor: C.white, border: `1px solid ${C.b1}` }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      {['#', 'Name', 'Employee ID', 'Mobile', 'Grade', 'Workload', 'Status'].map(h => (
                        <TableCell key={h}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((tech, idx) => (
                      <TableRow
                        key={tech.id}
                        onClick={() => selectTech(tech)}
                        selected={selected?.id === tech.id}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ color: C.t3, fontSize: '0.8rem', width: 40 }}>
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {tech.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: C.t2 }}>
                            {tech.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: '0.8rem', color: C.t2 }}>
                            {tech.mobile || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <GradeChip grade={tech.skill_level} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <WorkloadBar hours={tech.occupied_wo_service_time} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Box sx={{
                              width: 6, height: 6, borderRadius: '50%',
                              bgcolor: tech.status === 'Active' ? C.green : C.t3,
                            }} />
                            <Typography sx={{ fontSize: '0.8rem', color: tech.status === 'Active' ? C.t1 : C.t3 }}>
                              {tech.status || 'Active'}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Detail panel */}
      {selected && (
        <Box sx={{ width: 320, borderLeft: `1px solid ${C.b1}`, bgcolor: C.white, overflow: 'auto', flexShrink: 0 }}>
          <Box sx={{ p: 3, borderBottom: `1px solid ${C.b1}` }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', mb: 0.25 }}>{selected.name}</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: C.t3, fontFamily: 'monospace' }}>{selected.id}</Typography>
          </Box>

          <Box sx={{ p: 3 }}>
            <Grid container spacing={2} mb={3}>
              {[
                ['Type',      selected.type || '—'],
                ['Grade',     `Grade ${selected.skill_level || '?'}`],
                ['Mobile',    selected.mobile || '—'],
                ['Workload',  `${selected.occupied_wo_service_time || 0}h`],
                ['Score',     selected.performance_score || '—'],
                ['Status',    selected.status || 'Active'],
              ].map(([l, v]) => (
                <Grid item xs={6} key={l}>
                  <Typography sx={{ fontSize: '0.65rem', color: C.t3, textTransform: 'uppercase',
                    letterSpacing: '0.07em', mb: 0.25 }}>{l}</Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: C.t1 }}>{v}</Typography>
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ mb: 2.5 }} />

            <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', color: C.t3,
              textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}>
              Assigned Jobs ({techJobs.length})
            </Typography>

            {techJobs.length === 0 ? (
              <Typography sx={{ fontSize: '0.875rem', color: C.t3 }}>No jobs assigned</Typography>
            ) : techJobs.map(job => (
              <Box key={job.id} sx={{ py: 1.75, borderBottom: `1px solid ${C.b1}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: C.blue, fontFamily: 'monospace' }}>
                    {job.work_order_no}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700,
                    color: STATUS_COLOR[job.status] || C.t3 }}>
                    {job.status}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.8rem', color: C.t2 }}>{job.customer_name}</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: C.t3 }}>
                  {job.locality || job.city} · {job.product_group}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
