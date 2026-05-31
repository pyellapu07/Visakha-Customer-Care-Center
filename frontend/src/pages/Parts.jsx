import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button, Grid,
  CircularProgress, Stack, Divider, Table, TableHead,
  TableBody, TableRow, TableCell,
} from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getPartRequests, updatePartRequest } from '../api';
import { C } from '../theme';
dayjs.extend(relativeTime);

const STATUS = {
  Pending:    { bg: C.amberLight,  color: C.amber,  icon: HourglassEmptyRoundedIcon },
  Dispatched: { bg: C.blueLight,   color: C.blue,   icon: LocalShippingOutlinedIcon },
  Ordered:    { bg: C.purpleLight, color: C.purple, icon: ShoppingCartOutlinedIcon },
  Collected:  { bg: C.greenLight,  color: C.green,  icon: CheckCircleOutlineRoundedIcon },
};

export default function Parts() {
  const [requests, setRequests] = useState([]);
  const [filter,   setFilter]   = useState('Pending');
  const [loading,  setLoading]  = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getPartRequests(filter ? { status: filter } : {});
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: C.bgPage }}>
      <Box sx={{ px: 3.5, py: 2.5, bgcolor: '#fff', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.4rem', mb: 0.25 }}>Parts Requests</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: C.textSecondary }}>
          Manage spare part requests from field technicians
        </Typography>
      </Box>

      <Box sx={{ p: 3.5 }}>
        {/* Status filter tabs */}
        <Stack direction="row" spacing={1} mb={3}>
          {['', 'Pending', 'Dispatched', 'Ordered', 'Collected'].map(s => {
            const st = STATUS[s];
            return (
              <Button
                key={s}
                variant={filter === s ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setFilter(s)}
                sx={{
                  height: 36, borderRadius: 2,
                  borderColor: C.border,
                  ...(filter !== s && { color: C.textSecondary }),
                }}
              >
                {s || 'All Requests'}
              </Button>
            );
          })}
        </Stack>

        <Card>
          <Table>
            <TableHead>
              <TableRow>
                {['Part', 'Work Order', 'Technician', 'Qty', 'Status', 'Requested', 'Actions'].map(h => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography sx={{ color: C.textMuted }}>
                      {filter ? `No ${filter.toLowerCase()} requests` : 'No part requests yet'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : requests.map(req => {
                const st = STATUS[req.status] || STATUS.Pending;
                const Icon = st.icon;
                const nextActions = {
                  Pending:    ['Dispatched', 'Ordered'],
                  Dispatched: ['Collected'],
                  Ordered:    ['Collected'],
                };
                return (
                  <TableRow key={req.id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {req.part_description || 'Unknown part'}
                      </Typography>
                      {req.part_number && (
                        <Typography sx={{ fontSize: '0.72rem', color: C.textSecondary, fontFamily: 'monospace' }}>
                          #{req.part_number}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.8rem', color: C.blue, fontFamily: 'monospace', fontWeight: 600 }}>
                        {req.job_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.8rem' }}>{req.technician_id || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>{req.quantity}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<Icon sx={{ fontSize: 13 }} />}
                        label={req.status}
                        size="small"
                        sx={{ bgcolor: st.bg, color: st.color, fontWeight: 700, fontSize: '0.7rem', height: 24 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.8rem', color: C.textSecondary }}>
                        {dayjs(req.requested_at).fromNow()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75}>
                        {(nextActions[req.status] || []).map(action => (
                          <Button
                            key={action}
                            size="small"
                            variant="outlined"
                            onClick={() => updatePartRequest(req.id, action).then(load)}
                            sx={{ height: 28, fontSize: '0.72rem', borderColor: C.border, color: C.textPrimary, whiteSpace: 'nowrap' }}
                          >
                            → {action}
                          </Button>
                        ))}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </Box>
    </Box>
  );
}
